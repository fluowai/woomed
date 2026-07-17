const { execSync } = require('child_process');
try {
  execSync('git checkout server/database.ts');
  console.log("Restored successfully");
} catch(e) {
  console.log("Error restoring: ", e.message);
}
