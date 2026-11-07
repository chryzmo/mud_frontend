// The world the content-mode end-to-end tests play in, written fresh for each run so the event times are
// relative to now. Nothing here is the real world: it is a few generic rooms that exercise what the client
// shows (a walkthrough, a person, scenery, an event on now and one coming, a sticker).
import { createHmac } from 'node:crypto';

export const CODE_SECRET = 'e2e-only-secret'; // pre-commit: allow-secret (a fake HMAC key; only the e2e server uses it)
export const STICKER_CODE = 'ABCD-2345'; // a code that exists only in this fixture

const hashOf = (code) => createHmac('sha256', CODE_SECRET).update(code.replace(/-/g, '')).digest('hex');
const at = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; // minute precision

export function worldYaml(now = Date.now()) {
  return `start_room: gate
onboarding:
  welcome: "The Gatewarden bows. Welcome, traveller."
  steps:
    look: "Warden's tip: tap Look."
    move: "Warden's tip: take an exit."
    examine: "Warden's tip: examine the lamp."
    talk: "Warden's tip: talk to someone."
    say: "Warden's tip: say hello."
  finish: "Warden's tip: that is everything."
rooms:
  gate:
    name: The Gate
    description: A tall gate stands open onto a quiet yard.
    exits: {E: yard}
    features:
      lamp: {names: [lamp], examine: "A brass lamp hangs from a hook, unlit."}
    people:
      gatewarden:
        names: [Gatewarden]
        examine: "A broad keeper in a grey coat."
        greeting: "Well met. Mind the step."
  yard:
    name: The Yard
    description: A swept yard with a well in the middle.
    exits: {W: gate}
events:
  walk:
    title: Lantern Walk
    at: "${at(now - 5 * 60_000)}"
    duration: 2h
    steps:
      - {announce: "The Lantern Walk has begun."}
  feast:
    title: Grand Feast
    at: "${at(now + 3 * 3_600_000)}"
    duration: 1h
    steps:
      - {announce: "The feast is served."}
codes:
  founder:
    hash: ${hashOf(STICKER_CODE.replace('-', ''))}
    color: gold
    badge: star
    message: "A warm light finds you."
`;
}
