import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider } from ".";
import { SimulationPaymentProvider } from "./simulation";

const request = { idempotencyKey: "cle-test-0001", amountMinor: 1000, currency: "USD" as const, description: "Test" };

describe("SimulationPaymentProvider", () => {
  it("confirme une opération simulée", async () => {
    const provider = new SimulationPaymentProvider();
    const result = await provider.createCollection(request);
    expect(provider.isSimulation).toBe(true);
    expect(result.status).toBe("confirmed");
    expect(await provider.getCollectionStatus(result.providerReference)).toBe("confirmed");
  });

  it("est idempotent : même clé, même résultat", async () => {
    const provider = new SimulationPaymentProvider();
    const a = await provider.createCollection(request);
    const b = await provider.createCollection(request);
    expect(b).toBe(a);
  });

  it("peut simuler un échec", async () => {
    const result = await new SimulationPaymentProvider({ simulateFailure: true }).createCollection(request);
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBeTruthy();
  });

  it("refuse les montants invalides et tout webhook", async () => {
    const provider = new SimulationPaymentProvider();
    await expect(provider.createCollection({ ...request, amountMinor: 0 })).rejects.toThrow();
    await expect(provider.createCollection({ ...request, amountMinor: 10.5 })).rejects.toThrow();
    await expect(provider.verifyWebhook()).rejects.toThrow();
  });
});

describe("getPaymentProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("utilise la simulation par défaut", () => {
    expect(getPaymentProvider().id).toBe("simulation");
  });

  it("refuse tout autre mode", () => {
    vi.stubEnv("PAYMENTS_MODE", "production");
    expect(() => getPaymentProvider()).toThrow(/simulation/);
  });
});
