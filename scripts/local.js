const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

function lanIpv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

const ip = lanIpv4();
console.log("\n\x1b[35m━━ Private Messenger (LAN)\x1b[0m\n");
if (ip) {
  console.log(`  Your LAN IP:  \x1b[1m${ip}\x1b[0m`);
  console.log(`  Friends open: \x1b[1mhttp://${ip}:5173\x1b[0m`);
  console.log(`  (Ensure this machine's firewall allows ports 5173 and 3000.)\n`);
} else {
  console.log("  Could not detect a non-internal IPv4 address.");
  console.log("  Run `ip -4 addr` or `hostname -I` to find your LAN IP.\n");
}

const child = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
  cwd: path.join(__dirname, ".."),
});

child.on("exit", (code) => process.exit(code ?? 0));
