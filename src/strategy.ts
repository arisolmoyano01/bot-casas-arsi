import type { Movement, State, PieceId } from "./types.js";

type PosicionPieza = {
  id: PieceId;
  fila: number;
  columna: number;
};

type PosicionCasa = {
  fila: number;
  columna: number;
};

function analizarTablero(state: State) {
  const piezasPropias: PosicionPieza[] = [];
  const piezasRivales: PosicionPieza[] = [];
  const casas: PosicionCasa[] = [];

  for (let fila = 0; fila < state.tablero.length; fila++) {
    for (let columna = 0; columna < state.tablero[fila].length; columna++) {
      const casilla = state.tablero[fila][columna];

      // Casa neutral
      if (casilla === "N") {
        casas.push({
          fila,
          columna
        });
      }

      // Ficha
      else if (casilla !== "") {
        const pieza = {
          id: casilla,
          fila,
          columna
        };

        // Ficha propia
        if (casilla.startsWith(state.jugador)) {
          piezasPropias.push(pieza);
        }

        // Ficha rival
        else {
          piezasRivales.push(pieza);
        }
      }
    }
  }

  return {
    piezasPropias,
    piezasRivales,
    casas
  };
}

export function chooseMove(state: State): Movement {
  const { piezasPropias } = analizarTablero(state);

  const movimientos: Movement = {};

  // Por ahora las fichas siguen yendo al norte.
  // Después reemplazamos esto por la estrategia inteligente.
  for (const pieza of piezasPropias) {
    Object.assign(movimientos, {
      [pieza.id]: "N" as const
    });
  }

  return movimientos;
}