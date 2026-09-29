import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expect, test } from "@jest/globals";
import { app } from "../src/app.js";
import { isState } from "../src/state.js";
import { chooseMove } from "../src/strategy.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/state1.json", import.meta.url),
    "utf8"
  )
);

const direcciones = ["N", "S", "E", "O"] as const;

function obtenerPiezas(tablero: string[][], jugador: "A" | "B") {
  const piezas: string[] = [];

  for (const fila of tablero) {
    for (const casilla of fila) {
      if (casilla.startsWith(jugador)) {
        piezas.push(casilla);
      }
    }
  }

  return piezas;
}

test("devuelve movimientos para las piezas del jugador", () => {
  assert.ok(isState(fixture));

  const original = structuredClone(fixture);

  for (const jugador of ["A", "B"] as const) {
    const state = {
      ...fixture,
      jugador
    };

    const movimiento = chooseMove(state);
    const piezas = obtenerPiezas(state.tablero, jugador);

    expect(Object.keys(movimiento).sort()).toEqual(
      piezas.sort()
    );

    for (const direccion of Object.values(movimiento)) {
      expect(direcciones).toContain(direccion);
    }
  }

  expect(fixture).toEqual(original);
});

test("mueve todas las fichas propias", () => {
  const state = structuredClone(fixture);

  state.jugador = "A";

  state.tablero[2][3] = "A2";
  state.tablero[8][4] = "A3";
  state.tablero[7][8] = "B3";

  const original = structuredClone(state);

  const movimiento = chooseMove(state);

  expect(Object.keys(movimiento).sort()).toEqual([
    "A1",
    "A2",
    "A3"
  ]);

  for (const direccion of Object.values(movimiento)) {
    expect(direcciones).toContain(direccion);
  }

  expect(state).toEqual(original);
});

test.each(["A", "B"] as const)(
  "devuelve un objeto vacío si %s no tiene fichas",
  jugador => {
    const state = structuredClone(fixture);

    state.jugador = jugador;

    state.tablero.forEach(row => row.fill(""));

    state.tablero[0][0] = "N";
    state.tablero[1][1] =
      jugador === "A" ? "B1" : "A1";

    expect(chooseMove(state)).toEqual({});
  }
);

test("elige una casa si puede conquistarla", () => {
  const state = structuredClone(fixture);

  state.jugador = "A";
  state.dado = 3;

  state.tablero.forEach(row => row.fill(""));

  state.tablero[2][2] = "A1";
  state.tablero[2][5] = "N";

  const movimiento = chooseMove(state);

  expect(movimiento).toEqual({
    A1: "E"
  });
});

test("usa el tablero toroidal", () => {
  const state = structuredClone(fixture);

  state.jugador = "A";
  state.dado = 2;

  state.tablero.forEach(row => row.fill(""));

  state.tablero[0][5] = "A1";
  state.tablero[8][5] = "N";

  const movimiento = chooseMove(state);

  expect(movimiento).toEqual({
    A1: "N"
  });
});

test("POST /move valida el estado y devuelve movimientos", async () => {
  const server = app.listen(0, "127.0.0.1");

  await new Promise<void>(resolve =>
    server.once("listening", resolve)
  );

  const address = server.address();

  assert.ok(address && typeof address !== "string");

  const post = (body: string) =>
    fetch(
      `http://127.0.0.1:${address.port}/move`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body
      }
    );

  try {
    for (const jugador of ["A", "B"] as const) {
      const state = {
        ...fixture,
        jugador
      };

      const response = await post(
        JSON.stringify(state)
      );

      expect(response.status).toBe(200);

      const movimiento = await response.json();

      expect(
        Object.keys(movimiento as object).sort()
      ).toEqual(
        obtenerPiezas(
          state.tablero,
          jugador
        ).sort()
      );
    }

    for (const dado of [1, 2, 3]) {
      const response = await post(
        JSON.stringify({
          ...fixture,
          dado
        })
      );

      expect(response.status).toBe(200);
    }

    const badCell = structuredClone(fixture);
    badCell.tablero[0][0] = null;

    const shortRow = structuredClone(fixture);
    shortRow.tablero[0].pop();

    const invalidos = [
      null,
      {},
      {
        ...fixture,
        jugador: "C"
      },
      ...[0, 4, 5, 6, 7, 1.5, "3"].map(
        dado => ({
          ...fixture,
          dado
        })
      ),
      {
        ...fixture,
        tablero: fixture.tablero.slice(1)
      },
      badCell,
      shortRow
    ];

    for (const invalido of invalidos) {
      const response = await post(
        JSON.stringify(invalido)
      );

      expect(response.status).toBe(400);
    }

    const jsonInvalido = await post("{invalid");

    expect(jsonInvalido.status).toBe(400);
  } finally {
    await new Promise<void>(
      (resolve, reject) =>
        server.close(error =>
          error ? reject(error) : resolve()
        )
    );
  }
});