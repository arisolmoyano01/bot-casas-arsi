// @ts-nocheck

import { createServer } from "node:http";

const direcciones = ["N", "S", "E", "O"];

function responder(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

async function leerBody(req) {
  let data = "";

  for await (const chunk of req) {
    data += chunk;
  }

  return JSON.parse(data || "{}");
}

function estadoValido(state) {
  if (!state || typeof state !== "object") return false;

  if (state.jugador !== "A" && state.jugador !== "B") {
    return false;
  }

  if (
    !Number.isInteger(state.dado) ||
    state.dado < 1 ||
    state.dado > 3
  ) {
    return false;
  }

  if (
    !Array.isArray(state.tablero) ||
    state.tablero.length !== 10
  ) {
    return false;
  }

  return state.tablero.every(
    fila =>
      Array.isArray(fila) &&
      fila.length === 10
  );
}

function leerTablero(state) {
  const propias = [];
  const rivales = [];
  const casas = [];

  for (let fila = 0; fila < 10; fila++) {
    for (let columna = 0; columna < 10; columna++) {
      const valor = state.tablero[fila][columna];

      if (valor === "N") {
        casas.push({ fila, columna });
      } else if (valor !== "") {
        const pieza = {
          id: valor,
          fila,
          columna
        };

        if (valor.startsWith(state.jugador)) {
          propias.push(pieza);
        } else {
          rivales.push(pieza);
        }
      }
    }
  }

  return { propias, rivales, casas };
}

function destino(pieza, direccion, dado) {
  let fila = pieza.fila;
  let columna = pieza.columna;

  if (direccion === "N") {
    fila = (fila - dado + 10) % 10;
  }

  if (direccion === "S") {
    fila = (fila + dado) % 10;
  }

  if (direccion === "E") {
    columna = (columna + dado) % 10;
  }

  if (direccion === "O") {
    columna = (columna - dado + 10) % 10;
  }

  return { fila, columna };
}

function iguales(a, b) {
  return (
    a.fila === b.fila &&
    a.columna === b.columna
  );
}

function distancia(a, b) {
  const df = Math.abs(a.fila - b.fila);
  const dc = Math.abs(a.columna - b.columna);

  return (
    Math.min(df, 10 - df) +
    Math.min(dc, 10 - dc)
  );
}

function puntaje(destinos, casas) {
  let total = 0;

  for (const pos of destinos) {
    const captura = casas.some(casa =>
      iguales(pos, casa)
    );

    if (captura) {
      total += 1000;
      continue;
    }

    let menor = Infinity;
    let preparado = false;

    for (const casa of casas) {
      const d = distancia(pos, casa);

      if (d < menor) {
        menor = d;
      }

      if (pos.fila === casa.fila) {
        const dif = Math.abs(
          pos.columna - casa.columna
        );

        const horizontal = Math.min(
          dif,
          10 - dif
        );

        if (
          horizontal >= 1 &&
          horizontal <= 3
        ) {
          preparado = true;
        }
      }

      if (pos.columna === casa.columna) {
        const dif = Math.abs(
          pos.fila - casa.fila
        );

        const vertical = Math.min(
          dif,
          10 - dif
        );

        if (
          vertical >= 1 &&
          vertical <= 3
        ) {
          preparado = true;
        }
      }
    }

    if (preparado) {
      total += 100;
    }

    if (menor !== Infinity) {
      total -= menor;
    }
  }

  return total;
}

function elegirMovimiento(state) {
  const {
    propias,
    rivales,
    casas
  } = leerTablero(state);

  const mejor = {
    movimiento: null,
    puntos: -Infinity
  };

  function probar(
    indice,
    movimientos,
    destinos
  ) {
    if (indice === propias.length) {
      const puntos = puntaje(
        destinos,
        casas
      );

      if (puntos > mejor.puntos) {
        mejor.puntos = puntos;
        mejor.movimiento = {
          ...movimientos
        };
      }

      return;
    }

    const pieza = propias[indice];

    for (const direccion of direcciones) {
      const pos = destino(
        pieza,
        direccion,
        state.dado
      );

      const ocupaRival = rivales.some(
        rival => iguales(pos, rival)
      );

      if (ocupaRival) {
        continue;
      }

      const repetido = destinos.some(
        otro => iguales(pos, otro)
      );

      if (repetido) {
        continue;
      }

      movimientos[pieza.id] = direccion;
      destinos.push(pos);

      probar(
        indice + 1,
        movimientos,
        destinos
      );

      destinos.pop();
      delete movimientos[pieza.id];
    }
  }

  probar(0, {}, []);

  if (!mejor.movimiento) {
    throw new Error(
      "No hay movimiento válido"
    );
  }

  return mejor.movimiento;
}

const server = createServer(
  async (req, res) => {
    try {
      const url = new URL(
        req.url || "/",
        "http://localhost"
      );

      const path = url.pathname;

      if (
        req.method === "GET" &&
        path === "/"
      ) {
        return responder(res, 200, {
          status: "ok",
          bot: "Bot Casas Arsi"
        });
      }

      if (
        req.method === "GET" &&
        path === "/health"
      ) {
        return responder(res, 200, {
          status: "ok"
        });
      }

      if (
        req.method === "GET" &&
        path === "/profile"
      ) {
        return responder(res, 200, {
          name: "Bot Casas Arsi",
          colors: [
            "#6C63FF",
            "#A5A1FF",
            "#FFFFFF"
          ]
        });
      }

      if (
        req.method === "POST" &&
        path === "/move"
      ) {
        const state =
          await leerBody(req);

        if (!estadoValido(state)) {
          return responder(res, 400, {
            error:
              "Estado de juego inválido"
          });
        }

        const movimiento =
          elegirMovimiento(state);

        return responder(
          res,
          200,
          movimiento
        );
      }

      return responder(res, 404, {
        error: "Ruta no encontrada"
      });

    } catch (error) {
      console.error(error);

      return responder(res, 500, {
        error: "Error interno del bot"
      });
    }
  }
);

const port =
  Number(process.env.PORT) || 3000;

server.listen(port, () => {
  console.log(
    `Bot escuchando en puerto ${port}`
  );
});
