module.exports = {
    routes: [
        {
            method: "GET",
            path: "/eco-coin-transactions/me",
            handler: "eco-coin-transaction.me",
            config: { auth: {} }
        }
    ]
};