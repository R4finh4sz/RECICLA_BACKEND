export default {
  routes: [
    {
      method: "GET",
      path: "/termos/active",
      handler: "api::termo.termo.getActive",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/autoregister/termos/active",
      handler: "api::termo.termo.getActive",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/termos/active/pdf",
      handler: "api::termo.termo.downloadActivePdf",
      config: { auth: false },
    },
  ],
};
