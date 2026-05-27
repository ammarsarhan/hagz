export default class PaymentService {
    createIntention = async () => {
        return {
            clientSecret: "some-random-client-secret",
            transactionRef: "some-random-transaction-ref"
        };
    }
}