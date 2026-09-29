import type {
  Direction,
  Movement,
  PieceId,
  State
} from "./types.js";

type Posicion = {
  fila: number;
  columna: number;
};

type Pieza = Posicion & {
  id: PieceId;
};

const direcciones: Direction[] = ["N", "S", "E", "O"];


// Lee el tablero y separa las fichas y las casas
function leerTablero(state: State) {
  const propias: Pieza[] = [];
  const rivales: Pieza[] = [];
  const casas: Posicion[] = [];

  for (let fila = 0; fila < 10; fila++) {
    for (let columna = 0; columna < 10; columna++) {
      const casilla = state.tablero[fila][columna];

      if (casilla === "N") {
        casas.push({ fila, columna });
      }

      else if (casilla !== "") {
        const pieza: Pieza = {
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


// Calcula dónde termina una ficha según el dado
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

  return {
    fila,
    columna
  };
}


// Comprueba si dos posiciones son iguales
function mismaPosicion(a: Posicion, b: Posicion) {
  return (
    a.fila === b.fila &&
    a.columna === b.columna
  );
}


// Calcula la distancia teniendo en cuenta que el tablero no tiene bordes
function distancia(a: Posicion, b: Posicion) {
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


// Puntúa una combinación de movimientos
function calcularPuntaje(
  destinos: Posicion[],
  casas: Posicion[]
) {
  let puntos = 0;

  for (const destino of destinos) {

    const llegaACasa = casas.some(casa =>
      mismaPosicion(destino, casa)
    );

    // Si cae exactamente en una casa,
    // tiene la prioridad más alta.
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


      // Si queda en la misma fila que una casa
      if (destino.fila === casa.fila) {

        const diferencia = Math.abs(
          destino.columna - casa.columna
        );

        const distanciaHorizontal = Math.min(
          diferencia,
          10 - diferencia
        );

        // El dado solamente puede ser 1, 2 o 3.
        // Entonces quedar a esa distancia puede permitir
        // conquistar la casa en el próximo turno.
        if (
          distanciaHorizontal >= 1 &&
          distanciaHorizontal <= 3
        ) {
          preparadaParaProximoTurno = true;
        }
      }


      // Si queda en la misma columna que una casa
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


    // Premia quedar bien ubicado para el turno siguiente
    if (preparadaParaProximoTurno) {
      puntos += 100;
    }


    // Entre dos movimientos parecidos,
    // conviene quedar más cerca de una casa.
    if (menorDistancia !== Infinity) {
      puntos -= menorDistancia;
    }
  }

  return puntos;
}


// Función principal del bot
export function chooseMove(state: State): Movement {

  const {
    propias,
    rivales,
    casas
  } = leerTablero(state);


  // Si no tiene fichas, no hay movimientos
  if (propias.length === 0) {
    return {};
  }


  let mejorMovimiento: Movement = {};
  let mejorPuntaje = -Infinity;


  // Prueba distintas combinaciones de movimientos
  function probar(
    indice: number,
    movimientos: Movement,
    destinos: Posicion[]
  ) {

    // Si ya elegimos una dirección para todas las fichas,
    // calculamos qué tan buena es esa combinación.
    if (indice === propias.length) {

      const puntos = calcularPuntaje(
        destinos,
        casas
      );

      if (puntos > mejorPuntaje) {
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


      // No puede terminar sobre una ficha rival
      const hayRival = rivales.some(rival =>
        mismaPosicion(destino, rival)
      );

      if (hayRival) {
        continue;
      }


      // Dos fichas propias no pueden terminar
      // en la misma casilla.
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


      // Volvemos atrás para probar otra dirección
      destinos.pop();
      delete movimientos[pieza.id];
    }
  }


  probar(0, {}, []);

  return mejorMovimiento;
}