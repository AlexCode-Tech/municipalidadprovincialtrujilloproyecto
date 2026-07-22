const dns = require('dns');
dns.resolve4('db.xqhjipccolswhhhbqqcd.supabase.co', (err, addresses) => {
  if (err) console.error("Error resolviendo IPv4:", err);
  else console.log("Direcciones IPv4:", addresses);
});
