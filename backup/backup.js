const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const MONGO_URI = process.env.MONGO_URI;

const pastaBackup = path.join(__dirname, "backup");

if (!fs.existsSync(pastaBackup)) {
  fs.mkdirSync(pastaBackup);
}

function fazerBackup() {

  const data = new Date().toISOString().split("T")[0];

  const arquivo = path.join(pastaBackup, `backup-${data}.gz`);

  const comando = `mongodump --uri="${MONGO_URI}" --archive=${arquivo} --gzip`;

  exec(comando, (error) => {

    if (error) {
      console.log("Erro no backup:", error);
      return;
    }

    console.log("Backup criado:", arquivo);

    limparBackupsAntigos();

  });

}

function limparBackupsAntigos() {

  const arquivos = fs.readdirSync(pastaBackup);

  const hoje = new Date();

  arquivos.forEach((file) => {

    const caminho = path.join(pastaBackup, file);

    const stats = fs.statSync(caminho);

    const dias = (hoje - stats.mtime) / (1000 * 60 * 60 * 24);

    if (dias > 30) {

      fs.unlinkSync(caminho);

      console.log("Backup antigo removido:", file);

    }

  });

}

setInterval(fazerBackup, 24 * 60 * 60 * 1000);

fazerBackup();