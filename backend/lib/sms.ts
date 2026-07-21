import "server-only";

export type ResultadoSMS = {
  enviado: boolean;
  simulado: boolean;
  sid?: string;
  error?: string;
};

/** Formatea números telefónicos al formato internacional E.164 (ej. 935082862 -> +51935082862) */
function normalizarTelefono(telefono: string): string {
  const limpio = telefono.replace(/\D/g, "");
  if (limpio.startsWith("51") && limpio.length === 11) {
    return `+${limpio}`;
  }
  if (limpio.length === 9 && limpio.startsWith("9")) {
    return `+51${limpio}`;
  }
  return telefono.startsWith("+") ? telefono : `+${limpio}`;
}

export async function enviarSMS(input: { to: string; message: string }): Promise<ResultadoSMS> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const toFormatted = normalizarTelefono(input.to);

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[SMS SIMULACIÓN - Sin credenciales Twilio] Para: ${toFormatted} | Mensaje: ${input.message}`);
    return { enviado: true, simulado: true, error: "Credenciales de Twilio no configuradas" };
  }

  const fromFormatted = normalizarTelefono(fromNumber);

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const params = new URLSearchParams();
    params.append("From", fromFormatted);
    params.append("To", toFormatted);
    params.append("Body", input.message);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string; status?: string; code?: number };

    if (!response.ok) {
      const errorMsg = data.message || `Error HTTP ${response.status} de Twilio`;
      console.warn(`[SMS Twilio Fallido - Usando Fallback] Para: ${toFormatted} | Error: ${errorMsg}`);
      return { enviado: true, simulado: true, error: errorMsg };
    }

    console.log(`[SMS Twilio Enviado Exitosamente] SID: ${data.sid} | Para: ${toFormatted}`);
    return { enviado: true, simulado: false, sid: data.sid };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[SMS Twilio Exception - Usando Fallback] Para: ${toFormatted} | Exception: ${errorMsg}`);
    return { enviado: true, simulado: true, error: errorMsg };
  }
}
