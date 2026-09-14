// Legacy private demo seed intentionally retired before the first public alpha.
//
// Existing installations have already recorded this migration and keep all
// user-owned data unchanged. Fresh installations record the no-op, then receive
// the small generic workspace from 1710000055_public_demo_seed.js.
migrate((app) => {
    // Intentionally empty.
}, (app) => {
    // Intentionally empty.
})
