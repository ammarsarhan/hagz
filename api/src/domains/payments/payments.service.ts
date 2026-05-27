export default class PaymentService {
    // Todo: Initiate the actual intention process on Paymob.
    createIntention = async () => {
        return {
            clientSecret: "some-random-client-secret",
            transactionRef: "some-random-transaction-ref"
        };
    }

    // Todo: Create the actual webhook response handler with Paymob.
}