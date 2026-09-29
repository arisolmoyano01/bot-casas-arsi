import type { Direction, Movement, PieceId, State } from "./types.js";

type Posicion = {
  fila: number;
  columna: number;
};

type Pieza = Posicion & {
  id: PieceId;
};

const direcciones: Direction[] = ["N", "S", "E", "O"];

function leerTablero(state: State) {
  const propias: Pieza[] = [];
  const rivales: Pieza[] = [];
  const casas: Posicion[] = [];

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

  return { propias, rivales, casas };
}

function calcularDestino(
  pieza: Posicion,
  direccion: Direction,
  dado: number
): Posicion {

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

function mismaPosicion(a: Posicion, b: Posicion) {
  return a.fila === b.fila && a.columna === b.columna;
}

function distancia(a: Posicion, b: Posicion) {
  const diferenciaFila = Math.abs(a.fila - b.fila);
  const diferenciaColumna = Math.abs(a.columna - b.columna);

  const fila = Math.min(diferenciaFila, 10 - diferenciaFila);
  const columna = Math.min(diferenciaColumna, 10 - diferenciaColumna);

  return fila + columna;
}

function calcularPuntaje(destinos: Posicion[], casas: Posicion[]) {
  let puntos = 0;

  for (const destino of destinos) {
    const llegaACasa = casas.some(casa =>
      mismaPosicion(destino, casa)
    );

    if (llegaACasa) {
      puntos += 1000;
      continue;
    }

    if (casas.length > 0) {
      let menorDistancia = Infinity;

      for (const casa of casas) {
        const d = distancia(destino, casa);

        if (d < menorDistancia) {
          menorDistancia = d;
        }
      }

      puntos -= menorDistancia;
    }
  }

  return puntos;
}

export function chooseMove(state: State): Movement {
  const { propias, rivales, casas } = leerTablero(state);

  if (propias.length === 0) {
    return {};
  }

  let mejorMovimiento: Movement = {};
  let mejorPuntaje = -Infinity;

  function probar(
    indice: number,
    movimientos: Movement,
    destinos: Posicion[]
  ) {
    if (indice === propias.length) {
      const puntos = calcularPuntaje(destinos, casas);

      if (puntos > mejorPuntaje) {
        mejorPuntaje = puntos;
        mejorMovimiento = { ...movimientos };
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

      probar(indice + 1, movimientos, destinos);

      destinos.pop();
      delete movimientos[pieza.id];
    }
  }

  probar(0, {}, []);

  return mejorMovimiento;
}