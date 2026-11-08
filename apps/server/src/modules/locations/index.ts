// Marketplaces (countries) and the reference data inside each: the location tree and the amenity
// catalog. Admins manage them on the Platform page; the apps read them.
export { isMarketplaceCallingCode } from "./application/marketplace-calling-codes";
export { locationsRoutes, platformAdminRoutes } from "./http/routes";
