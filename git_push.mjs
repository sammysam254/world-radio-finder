import { execSync } from "child_process";

const run = (cmd, opts = {}) => {
  console.log(`> ${cmd}`);
  try {
    const out = execSync(cmd, {
      cwd: "C:\\Users\\sammy\\Desktop\\radio\\world-radio-finder",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    });
    if (out.trim()) console.log(out.trim());
    return out.trim();
  } catch (e) {
    const msg = (e.stdout || "") + (e.stderr || "");
    if (msg.trim()) console.log(msg.trim());
    return null;
  }
};

console.log("\n🔧  Configuring git identity...");
run(`git config --global user.email "sammyseth260@gmail.com"`);
run(`git config --global user.name "sammysam254"`);

console.log("\n📋  Git status...");
run("git status");

console.log("\n🗑️  Removing .env from git tracking (if tracked)...");
run("git rm --cached .env");

console.log("\n➕  Staging changes...");
run("git add .gitignore");
run("git add supabase/config.toml");
run("git add supabase/migrations/00000000000000_full_schema.sql");
// Stage any other modified tracked files
run("git add -u");

console.log("\n📝  Committing...");
const commitOut = run(`git commit -m "migrate to own Supabase project (uwbjvhrqqknukfzzzsii)"`);

if (commitOut && commitOut.includes("nothing to commit")) {
  console.log("Nothing new to commit — already up to date.");
} 

console.log("\n🚀  Pushing to origin/main...");
run("git push origin main");

console.log("\n✅  Done! Check: https://github.com/sammysam254/world-radio-finder\n");
