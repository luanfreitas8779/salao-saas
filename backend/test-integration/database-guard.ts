// Trava de segurança: os testes de integração apagam TODAS as tabelas.
// Antes de qualquer coisa, confirma que o banco é mesmo o de teste.
// Se alguém apontar o .env.test para o banco de desenvolvimento por engano,
// os testes param aqui, antes de apagar qualquer dado.
export function assertTestDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definido para os testes de integração.");
  }

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Os testes de integração só rodam num banco cujo nome termina em "_test". ` +
        `Banco recebido: "${databaseName}". Confira o .env.test.`,
    );
  }
}
