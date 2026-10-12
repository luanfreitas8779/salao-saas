# Aprendendo testes do zero

Oi! Esta pasta é o seu caminho para aprender testes **sem pular etapa**.
Cada arquivo é um degrau. Você sobe um por vez, e só passa para o próximo quando o anterior fizer sentido.

---

## Primeiro, uma história (é para isso que testes existem)

Imagine que o seu sistema de login tem esta linha:

```ts
if (!passwordMatch) {
  throw new UnauthorizedError("Email ou senha incorretos");
}
```

Um dia, sem querer, alguém apaga o `!`:

```ts
if (passwordMatch) {          // <- agora está ao contrário
  throw new UnauthorizedError("Email ou senha incorretos");
}
```

O que acontece?

- Quem digita a senha **certa** leva erro.
- Quem digita a senha **errada** entra no sistema.

O servidor sobe normal. Não dá erro de compilação. Nada avisa.
Você só descobre quando um cliente reclama (ou pior: quando alguém entra na conta de outro).

**Um teste é o alarme que grita nessa hora**, antes de qualquer cliente ver.

É só isso. Teste é um alarme que você mesmo programa.

---

## A fórmula de todo teste

> **DADO** uma situação, **QUANDO** eu faço uma ação, **ENTÃO** espero um resultado.

Exemplo: *dado* um usuário com senha "123", *quando* ele loga com "999", *então* espero um erro 401.

Guarde isso. Todo teste do mundo é essa frase em código.

---

## A escada (os degraus)

| Degrau | Arquivo | O que você aprende | Dificuldade |
|---|---|---|---|
| 1 | `01-primeiro-teste.test.ts` | O teste mais simples do mundo. Ver verde e vermelho. | ⭐ |
| 2 | `02-funcao-do-projeto.test.ts` | Testar uma função REAL do seu projeto (sem dependências). | ⭐ |
| 3 | `03-dado-falso.test.ts` | Por que precisamos de "dado falso" e como fazer um. | ⭐⭐ |
| 4 | `04-erros-e-chamadas.test.ts` | Testar erro, e conferir se algo foi (ou não foi) chamado. | ⭐⭐ |
| 5 | `05-controller-simples.test.ts` | Testar um controller real (o `ProcedureController`): fabricar `req` e `res`. | ⭐⭐ |
| 6 | `src/app/user/user.service.test.ts` | O teste "de verdade" do login (service com regras). Com o que você aprendeu, você lê tudo. | ⭐⭐⭐ |

---

## Como rodar

Abra o terminal na pasta `backend` e rode **um arquivo por vez**:

```bash
npx vitest run estudo-testes/01
```

(`01` é só um pedaço do nome. Ele acha o arquivo sozinho.)

Para rodar tudo:

```bash
npm test
```

Se quiser que ele rode sozinho toda vez que você salvar (ótimo para estudar):

```bash
npx vitest estudo-testes/01
```

---

## Regras de ouro para estudar

1. **Não leia só. Mexa.** Cada arquivo tem uma seção "FAÇA VOCÊ" no meio. É lá que o aprendizado acontece.
2. **Deixe o teste ficar vermelho de propósito.** Ver o teste falhar é a melhor aula. Se ele nunca falha, você não sabe se ele funciona.
3. **Ignore o que eu mandar ignorar.** Nos arquivos eu aviso quando um trecho não importa agora. Confia.
4. **Um degrau por vez.** Se ficar confuso, volta um degrau.
