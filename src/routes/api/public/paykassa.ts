import { createFileRoute } from "@tanstack/react-router";

/**
 * Paykassa SCI IPN endpoint.
 *
 * Paykassa posts only `private_hash`; we call `sci_confirm_order` back with our
 * merchant credentials to obtain the authoritative payment data, so a forged
 * request can never credit a balance.
 *
 * Configure this URL in the Paykassa merchant settings:
 *   https://project--8c9e5284-5f27-44bc-91a1-6f71b4a407db.lovable.app/api/public/paykassa
 */
export const Route = createFileRoute("/api/public/paykassa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let privateHash = "";
        try {
          const form = await request.formData();
          privateHash = String(form.get("private_hash") ?? "");
        } catch {
          const body = await request.text();
          privateHash = new URLSearchParams(body).get("private_hash") ?? "";
        }
        if (!privateHash) return new Response("no private_hash", { status: 400 });

        const { confirmPaykassaOrder } = await import("@/lib/paykassa.server");
        const { creditDeposit } = await import("@/lib/deposits.server");

        try {
          const payment = await confirmPaykassaOrder(privateHash);
          if (!payment.orderId) return new Response("bad order", { status: 400 });

          const result = await creditDeposit({
            transactionId: payment.orderId,
            txid: payment.hash,
            note: `Paykassa ${payment.system} ${payment.currency}`,
          });
          if (!result.ok) {
            console.error("Paykassa IPN credit failed", payment.orderId, result.reason);
            return new Response(result.reason ?? "error", { status: 400 });
          }
          return new Response(`${payment.orderId}|success`);
        } catch (error) {
          console.error("Paykassa IPN error", error);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("ok"),
    },
  },
});
