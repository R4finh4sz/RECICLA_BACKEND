module.exports = {
	routes: [
		{
			method: "GET",
			path: "/eco-coin/me",
			handler: "eco-coin.me",
			config: { auth: {} }
		},
		{
			method: "POST",
			path: "/eco-coin/redeem",
			handler: "eco-coin.redeem",
			config: { auth: {} }
		}
	]
};