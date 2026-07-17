const fs = require('fs');
const bcrypt = require('bcrypt'); // or try bcryptjs if bcrypt fails

async function createUser() {
  const email = "paulo@wootech.com.br";
  const password = "Argo@15077399brsc";
  
  let hash;
  try {
    hash = require('bcryptjs').hashSync(password, 10);
  } catch (e) {
    try {
      hash = require('bcrypt').hashSync(password, 10);
    } catch(e2) {
      console.log("Could not find bcrypt to hash password");
      return;
    }
  }

  const user = {
    id: require('crypto').randomUUID(),
    email: email.toLowerCase(),
    name: "Paulo",
    role: "super_admin",
    passwordHash: hash,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  const storagePath = '/app/data/storage.json';
  if (fs.existsSync(storagePath)) {
    const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    
    // Remove if exists
    data.users = data.users.filter(u => u.email !== user.email);
    data.users.push(user);
    
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
    console.log("Usuário injetado com sucesso no JSON local!");
  } else {
    console.log("storage.json não encontrado em " + storagePath);
  }
}

createUser();
