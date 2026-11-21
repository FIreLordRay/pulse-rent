# Pulse Rent

Is this Chicago building safe to rent? Type an address and see what the city has on the building:
open and past code violations, 311 building complaints, the Building Code Scofflaw list, and whether it is
city-supported affordable housing. Part of the Pulse suite, next to [Pulse](https://firelordray.github.io/city-scorecard/).

All data is live from the City of Chicago Data Portal; the address is geocoded with OpenStreetMap and never stored.

| What | Dataset |
|---|---|
| Code violations | Building Violations `22u3-xenr` (grouped by `property_group`, so all addresses of a building count) |
| 311 complaints | 311 Service Requests `v6vf-nfxy` |
| Scofflaw list | Building Code Scofflaw List `crg5-4zyp` |
| Affordable housing | Affordable Rental Housing Developments `s6ha-ppgi` |

```
npm install
npm run dev
npm test
```
