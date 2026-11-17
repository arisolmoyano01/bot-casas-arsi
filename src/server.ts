import express from "express";

const app = express();

app.use(express.json());

const direcciones = ["N", "S", "E", "O"];

// Perfil opcional que consulta el árbitro
app.get("/profile", (req, res) => {
  res.json({
    name: "Bot Casas Arsi",
    colors: ["#6C63FF", "#A5A1FF", "#FFFFFF"]
  });
});

// Sirve para comprobar que el bot está funcionando
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    bot: "Bot Casas Arsi"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

function isState(state) {
  if (!state || typeof state !== "object") {
    return false;
  }

  if (state.jugador !== "A" && state.jugador !== "B") {
    return false;
  }

  if (
    typeof state.dado !== "number" ||
    !Number.isInteger(state.dado) ||
    state.dado < 1 ||
    state.dado > 3
  ) {
    return false;
  }

  if (!Array.isArray(state.tablero) || state.tablero.length !== 10) {
    return false;
  }

  for (const fila of state.tablero) {
    if (!Array.isArray(fila) || fila.length !== 10) {
      return false;
    }

    for (const casilla of fila) {
      if (typeof casilla !== "string") {
        return false;
      }

      if (
        casilla !== "" &&
        casilla !== "N" &&
        !/^[AB][1-9]\d*$/.test(casilla)
      ) {
        return false;
      }
    }
  }

  return true;
}

function leerTablero(state) {
  const propias = [];
  const rivales = [];
  const casas = [];

  for (let fila = 0; fila < 10; fila++) {
    for (let columna = 0; columna < 10; columna++) {
      const casilla = state.tablero[fila][columna];

      if (casilla === "N") {
        casas.push({ fila, columna });
      } else if (casilla !== "") {
        const pieza = {
          id: casilla,
          fila,
          columna
        };

        if (casilla.startsWith(state.jugador)) {
          propias.push(pieza);
        } else {
          rivales.push(pieza);
        }
      }
    }
  }

  return {
    propias,
    rivales,
    casas
  };
}

function calcularDestino(pieza, direccion, dado) {
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

  return {
    fila,
    columna
  };
}

function mismaPosicion(a, b) {
  return (
    a.fila === b.fila &&
    a.columna === b.columna
  );
}

function distancia(a, b) {
  const diferenciaFila = Math.abs(a.fila - b.fila);
  const diferenciaColumna = Math.abs(a.columna - b.columna);

  const fila = Math.min(
    diferenciaFila,
    10 - diferenciaFila
  );

  const columna = Math.min(
    diferenciaColumna,
    10 - diferenciaColumna
  );

  return fila + columna;
}

function calcularPuntaje(destinos, casas) {
  let puntos = 0;

  for (const destino of destinos) {
    const llegaACasa = casas.some(casa =>
      mismaPosicion(destino, casa)
    );

    if (llegaACasa) {
      puntos += 1000;
      continue;
    }

    let menorDistancia = Infinity;
    let preparadaParaProximoTurno = false;

    for (const casa of casas) {
      const d = distancia(destino, casa);

      if (d < menorDistancia) {
        menorDistancia = d;
      }

      if (destino.fila === casa.fila) {
        const diferencia = Math.abs(
          destino.columna - casa.columna
        );

        const distanciaHorizontal = Math.min(
          diferencia,
          10 - diferencia
        );

        if (
          distanciaHorizontal >= 1 &&
          distanciaHorizontal <= 3
        ) {
          preparadaParaProximoTurno = true;
        }
      }

      if (destino.columna === casa.columna) {
        const diferencia = Math.abs(
          destino.fila - casa.fila
        );

        const distanciaVertical = Math.min(
          diferencia,
          10 - diferencia
        );

        if (
          distanciaVertical >= 1 &&
          distanciaVertical <= 3
        ) {
          preparadaParaProximoTurno = true;
        }
      }
    }

    if (preparadaParaProximoTurno) {
      puntos += 100;
    }

    if (menorDistancia !== Infinity) {
      puntos -= menorDistancia;
    }
  }

  return puntos;
}

function chooseMove(state) {
  const {
    propias,
    rivales,
    casas
  } = leerTablero(state);

  if (propias.length === 0) {
    return {};
  }

  let mejorMovimiento = {};
  let mejorPuntaje = -Infinity;
  let encontroMovimiento = false;

  function probar(
    indice,
    movimientos,
    destinos
  ) {
    if (indice === propias.length) {
      const puntos = calcularPuntaje(
        destinos,
        casas
      );

      if (
        !encontroMovimiento ||
        puntos > mejorPuntaje
      ) {
        encontroMovimiento = true;
        mejorPuntaje = puntos;

        mejorMovimiento = {
          ...movimientos
        };
      }

      return;
    }

    const pieza = propias[indice];

    for (const direccion of direcciones) {
      const destino = calcularDestino(
        pieza,
        direccion,
        state.dado
      );

      const hayRival = rivales.some(rival =>
        mismaPosicion(destino, rival)
      );

      if (hayRival) {
        continue;
      }

      const chocaConOtra = destinos.some(otro =>
        mismaPosicion(destino, otro)
      );

      if (chocaConOtra) {
        continue;
      }

      movimientos[pieza.id] = direccion;
      destinos.push(destino);

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

  if (!encontroMovimiento) {
    throw new Error(
      "No se encontró una combinación válida de movimientos."
    );
  }

  return mejorMovimiento;
}

app.post("/move", (req, res) => {
  try {
    const state = req.body;

    if (!isState(state)) {
      return res.status(400).json({
        error: "Estado de juego inválido."
      });
    }

    const movimiento = chooseMove(state);

    return res.status(200).json(movimiento);
  } catch (error) {
    console.error("Error procesando /move:", error);

    return res.status(500).json({
      error: "Error interno del bot."
    });
  }
});

export default app;
