// Lumenhold interiors: the vaulted halls under the upper terrace, the three-storey
// royal wing, the tavern's guest floor and the townsfolk houses with lofts.
// Everything is placed in castle-local coordinates through the X/Y/Z helpers.
import * as THREE from 'three';
import * as PR from './props.js';

const C = (h) => new THREE.Color(h);
const WHITE = C('#eee7dc');
const TRIM = C('#ddd2c3');
const WARM = C('#fff4e6');
const PLASTER = C('#f3e9dc');
const VAULT = C('#e4dacd');
const DARK = C('#b9afa6');

export function buildInteriors(K) {
  const { B, X, Y, Z } = K;
  const objects = K.objects, lights = K.lights, lamps = K.lamps, fires = K.fires, spawn = K.spawn;

  // ---------- helpers ----------
  let doorN = 0;
  const door = (x, y, z, ry, w, h, o = {}) => objects.push({ t: 'door', id: o.id || 'd' + (doorN++), x: X(x), y: Y(y), z: Z(z), ry, w: w - 0.08, h: h - 0.04, ...o });
  const light = (x, y, z, color, intensity, dist, o = {}) => lights.push({ pos: new THREE.Vector3(X(x), Y(y), Z(z)), color, intensity, dist, ...o });
  const seat = (s) => { objects.push(s); return s; };
  const pick = (id, item, x, y, z, o = {}) => objects.push({ t: 'pickup', id, item, x: X(x), y: Y(y), z: Z(z), n: 1, ...o });
  const book = (id, bookId, x, y, z, ry = 0, o = {}) => objects.push({ t: 'book', id, book: bookId, x: X(x), y: Y(y), z: Z(z), ry, ...o });
  const box = (id, name, x, y, z, loot, o = {}) => objects.push({ t: 'container', id, name, x: X(x), y: Y(y), z: Z(z), loot, ...o });
  const bed = (x, y, z, o = {}) => objects.push({ t: 'bed', x: X(x), y: Y(y), z: Z(z), ...o });
  const torch = (x, y, z, ry) => PR.torch(B, X(x), Y(y), Z(z), ry, lamps, fires.small);
  const floor = (x0, x1, z0, z1, y, mat, color, uv = 0.25) => B.box(mat, X((x0 + x1) / 2), Y(y - 0.02), Z((z0 + z1) / 2), x1 - x0, 0.07, z1 - z0, 0, { color: C(color), collide: false, ao: false, uvScale: uv });

  // interior wall from (x0,z0) to (x1,z1) with door gaps [{at (distance from start), w, h}]
  const iwall = (x0, z0, x1, z1, y0, h, gaps = [], o = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    const t = o.t || 0.6, mat = o.mat || 'stone', color = o.color || PLASTER;
    const P = (d) => [x0 + ((x1 - x0) * d) / len, z0 + ((z1 - z0) * d) / len];
    let cur = 0;
    const seg = (a, b) => { if (b - a < 0.02) return; const [mx, mz] = P((a + b) / 2); B.box(mat, X(mx), Y(y0), Z(mz), t, h, b - a, ang, { color, aoBase: Y(y0) }); };
    for (const g of [...gaps].sort((a, b) => a.at - b.at)) {
      seg(cur, g.at - g.w / 2);
      const [gx, gz] = P(g.at);
      if (g.h < h) B.box(mat, X(gx), Y(y0 + g.h), Z(gz), t, h - g.h, g.w, ang, { color });
      if (o.frame !== false) {
        for (const sd of [-1, 1]) { const [fx, fz] = P(g.at + sd * (g.w / 2 + 0.08)); B.box('stone', X(fx), Y(y0), Z(fz), t + 0.12, g.h, 0.16, ang, { color: TRIM, collide: false, ao: false }); }
        B.box('stone', X(gx), Y(y0 + g.h), Z(gz), t + 0.12, 0.2, g.w + 0.32, ang, { color: TRIM, collide: false, ao: false });
      }
      cur = g.at + g.w / 2;
    }
    seg(cur, len);
  };
  // stone balustrade with posts and a collider rail
  const balustrade = (x0, z0, x1, z1, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    B.box('stone', X((x0 + x1) / 2), Y(y + 0.95), Z((z0 + z1) / 2), 0.32, 0.14, len, ang, { color: TRIM, collide: false, ao: false });
    B.box('stone', X((x0 + x1) / 2), Y(y), Z((z0 + z1) / 2), 0.36, 0.12, len, ang, { color: TRIM, collide: false, ao: false });
    const n = Math.max(2, Math.floor(len / 0.45));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.cyl('stone', X(x0 + (x1 - x0) * t), Y(y + 0.12), Z(z0 + (z1 - z0) * t), 0.07, 0.1, 0.83, 8, { color: WHITE, collide: false, ao: false });
    }
    K.collision.addBox(X((x0 + x1) / 2), Z((z0 + z1) / 2), 0.2, len / 2, Y(y), Y(y + 1.1), ang, { walkable: false });
  };
  // vaulted ceiling ribs across a room (visual)
  const ribs = (x0, x1, z0, z1, y, alongX, color = TRIM, step = 4) => {
    if (alongX) for (let z = z0 + step / 2; z < z1; z += step) B.box('stone', X((x0 + x1) / 2), Y(y - 0.45), Z(z), x1 - x0, 0.45, 0.5, 0, { color, collide: false, ao: false });
    else for (let x = x0 + step / 2; x < x1; x += step) B.box('stone', X(x), Y(y - 0.45), Z((z0 + z1) / 2), 0.5, 0.45, z1 - z0, 0, { color, collide: false, ao: false });
  };
  const beams = (x0, x1, z0, z1, y, step = 2.2) => {
    for (let x = x0 + step / 2; x < x1; x += step) B.box('wood', X(x), Y(y - 0.35), Z((z0 + z1) / 2), 0.3, 0.35, z1 - z0, 0, { color: C('#8a6246'), collide: false, ao: false });
  };

  undercroft();
  lore();
  royalWing();
  tavernUpper();
  houses();
  otherDoors();

  // ====================================================================
  // UNDERCROFT — vaulted halls inside the upper-ward terrace
  // ====================================================================
  function undercroft() {
    const TH = K.TH, TX = K.TX, TZ0 = K.TZ0, TZ1 = K.TZ1;
    const SL = TH - 1.2; // underside of the top slab
    const CEIL = 5.4;
    // top slab of the terrace
    B.box('stone', X(0), Y(SL), Z((TZ0 + TZ1) / 2), TX * 2, TH - SL, TZ1 - TZ0, 0, { color: WHITE, walkable: true, ao: false });
    const fill = (x0, x1, z0, z1, y0 = -4, y1 = SL) => B.box('stone', X((x0 + x1) / 2), Y(y0), Z((z0 + z1) / 2), x1 - x0, y1 - y0, z1 - z0, 0, { color: WHITE, aoBase: Y(0) });
    fill(-14, 14, TZ0, TZ1);
    for (const s of [-1, 1]) {
      const R = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
      fill(...R(14, TX), TZ0, -44);
      fill(...R(39.4, TX), -44, TZ1);
      fill(...R(14, 25.4), -10.6, TZ1);
      fill(...R(28.6, 39.4), -10.6, TZ1);
      fill(...R(25.4, 28.6), -10.6, TZ1, 4.2, SL);
      // hall ceiling mass (keeps the halls cosy, 5.4 m high)
      B.box('stone', X(s * 26.7), Y(CEIL), Z(-27.3), 25.4, SL - CEIL, 33.4, 0, { color: VAULT, walkable: true, ao: false });
      // grand portal on the terrace front
      const px = s * 27;
      for (const sd of [-1, 1]) {
        B.box('stone', X(px + sd * 2.05), Y(0), Z(TZ1 + 0.25), 0.9, 4.9, 0.5, 0, { color: TRIM, collide: false });
        B.cyl('stone', X(px + sd * 2.05), Y(4.9), Z(TZ1 + 0.25), 0.3, 0.45, 0.4, 8, { color: TRIM, collide: false });
      }
      B.box('stone', X(px), Y(4.2), Z(TZ1 + 0.3), 5, 0.9, 0.6, 0, { color: TRIM, collide: false });
      B.add('gold', new THREE.CylinderGeometry(1, 1, 1, 16), X(px), Y(4.65), Z(TZ1 + 0.62), Math.PI / 2, 0, 0, 0.32, 0.06, 0.32, { ao: false });
      PR.wallLantern(B, X(px - 2.9), Y(3.2), Z(TZ1 + 0.02), -Math.PI / 2, lamps);
      PR.wallLantern(B, X(px + 2.9), Y(3.2), Z(TZ1 + 0.02), -Math.PI / 2, lamps);
      // hanging sign
      B.box('iron', X(px + 2.9), Y(4.3), Z(TZ1 + 0.6), 0.05, 0.05, 1.2, 0, { collide: false, ao: false });
      B.box('wood', X(px + 2.9), Y(3.55), Z(TZ1 + 1.0), 0.08, 0.7, 0.9, 0, { color: C('#b88a60'), collide: false, ao: false });
      B.add('plain', new THREE.CylinderGeometry(1, 1, 1, 12), X(px + 2.9 + 0.05), Y(3.9), Z(TZ1 + 1.0), 0, 0, Math.PI / 2, 0.22, 0.02, 0.22, { color: C(s < 0 ? '#e8b060' : '#9fb8e8'), ao: false });
      door(px, 0, TZ1 - 0.35, Math.PI / 2, 3.2, 4.2, { id: s < 0 ? 'kitchen_front' : 'guard_front', name: s < 0 ? 'Кухня и погреба' : 'Караульня', arched: false, color: '#8f6242' });
    }

    // ---------------- WEST: kitchen, wine cellar, dungeons ----------------
    iwall(-39.4, -22, -14, -22, 0, CEIL, [{ at: 6.4, w: 2.0, h: 3.2 }, { at: 18.9, w: 2.0, h: 3.2 }], { t: 0.8 });
    iwall(-27, -44, -27, -22.4, 0, CEIL, [], { t: 0.8 });
    door(-33, 0, -22, Math.PI / 2, 2.0, 3.2, { id: 'cellar', name: 'Винный погреб' });
    door(-20.5, 0, -22, Math.PI / 2, 2.0, 3.2, { id: 'dungeon', name: 'Казематы', color: '#6f5a4a' });

    // --- kitchen (x -39.4..-14, z -22..-10.6)
    floor(-39.4, -14, -22, -10.6, 0, 'stone', '#e6d8c4', 0.4);
    beams(-39.4, -14, -22, -10.6, CEIL);
    PR.fireplace(B, X(-38.9), Y(0), Z(-16.3), Math.PI / 2, 4, lamps, fires.big, { hood: 3.2 });
    PR.pot(B, X(-38.1), Y(0.12), Z(-16.3), 0.32);
    light(-37.4, 1.4, -16.3, 0xff9a4a, 16, 13, { flicker: 0.12 });
    light(-26, 4.2, -16.3, 0xffd8a0, 9, 15);
    PR.table(B, X(-27), Y(0), Z(-16.3), 0, 5, 1.4, false);
    for (let i = 0; i < 6; i++) PR.pot(B, X(-29.3 + i * 0.9), Y(0.92), Z(-15.85), 0.1 + (i % 3) * 0.03, ['#8a8f9c', '#b87a4a', '#6a6f7a'][i % 3]);
    B.box('wood', X(-24.5), Y(0.92), Z(-16.6), 0.9, 0.06, 0.5, 0.2, { color: C('#c49a6c'), collide: false, ao: false }); // cutting board
    for (let i = 0; i < 5; i++) B.sphere('plain', X(-24.8 + i * 0.16), Y(1.02), Z(-16.6), 0.06, { color: C(['#e8604a', '#f0c040', '#7ab04a', '#f08a3a', '#e8604a'][i]), ao: false });
    pick('k_bread', 'bread', -28.4, 0.93, -16.7, { owner: 'kitchen' });
    pick('k_cheese', 'cheese', -27.6, 0.93, -16.75, { owner: 'kitchen' });
    pick('k_ham', 'ham', -26.4, 0.93, -16.7, { owner: 'kitchen' });
    pick('k_apple', 'apple', -25.6, 0.93, -15.9, { owner: 'kitchen' });
    PR.table(B, X(-19.5), Y(0), Z(-13), 0, 3.2, 1.1, true);
    PR.bench(B, X(-19.5), Y(0), Z(-13.95), Math.PI / 2, 3);
    PR.bench(B, X(-19.5), Y(0), Z(-12.05), Math.PI / 2, 3);
    for (const dx of [-0.9, 0.9]) { seat({ t: 'seat', x: X(-19.5 + dx), y: Y(0), z: Z(-13.95), face: 0, h: 0.5 }); seat({ t: 'seat', x: X(-19.5 + dx), y: Y(0), z: Z(-12.05), face: Math.PI, h: 0.5 }); }
    pick('k_roll', 'sweet_roll', -18.9, 0.93, -13.2, { owner: 'kitchen' });
    PR.bottleShelf(B, X(-26.75), Y(0), Z(-21.35), Math.PI / 2, 6, false);
    PR.bottleShelf(B, X(-26.75), Y(1.9), Z(-21.35), Math.PI / 2, 6, false);
    for (const [bx, bz] of [[-38.5, -21], [-37.6, -21.1], [-38.6, -11.5]]) PR.barrel(B, X(bx), Y(0), Z(bz), 0.95);
    for (const [sx, sz] of [[-15, -21], [-15.6, -20.4], [-14.8, -19.8]]) PR.sack(B, X(sx), Y(0), Z(sz), 1);
    PR.crate(B, X(-15), Y(0), Z(-11.6), 1.0, 0.1);
    PR.crate(B, X(-15.1), Y(1.0), Z(-11.7), 0.8, -0.2);
    box('k_crates', 'Ящики с провизией', -15.2, 0.8, -11.8, [['bread', [1, 2]], ['apple', [1, 3]], ['cheese', 1, 0.5]], { owner: 'kitchen', respawn: 1800 });
    box('k_barrel', 'Бочка с яблоками', -38.5, 0.8, -11.5, [['apple', [2, 4]]], { owner: 'kitchen', respawn: 1500 });
    PR.hangingHerbs(B, X(-30), Y(CEIL - 0.5), Z(-12.5), Math.PI / 2, 8);
    PR.hangingHerbs(B, X(-22), Y(CEIL - 0.5), Z(-19.5), Math.PI / 2, 6);
    for (let i = 0; i < 3; i++) B.sphere('plain', X(-33.5 + i * 0.8), Y(CEIL - 1.1), Z(-19.2), 0.22, { color: C('#b0653a'), sy: 1.6, ao: false }); // hams
    const lk = PR.lectern(B, X(-35.4), Y(0), Z(-20.4), Math.PI / 2);
    book('b_cookbook', 'cookbook', -35.4, lk.y - Y(0), -20.4, Math.PI / 2, {});
    torch(-33, 2.5, -10.9, Math.PI);
    torch(-20.5, 2.5, -10.9, Math.PI);
    spawn.bertha = new THREE.Vector3(X(-27), Y(0), Z(-17.6));
    spawn.kitchenBoy = new THREE.Vector3(X(-21), Y(0), Z(-18));

    // --- wine cellar (x -39.4..-27, z -44..-22)
    floor(-39.4, -27, -44, -22.4, 0, 'cobble', '#b8aa9c', 0.3);
    ribs(-39.4, -27, -44, -22, CEIL, true, TRIM, 4.4);
    for (const tz of [-26.5, -31.5, -36.5]) PR.tun(B, X(-37.7), Y(0), Z(tz), Math.PI / 2, 1.15, 2.3);
    PR.wineRack(B, X(-27.7), Y(0), Z(-29), -Math.PI / 2, 4.4, 2.4);
    PR.wineRack(B, X(-27.7), Y(0), Z(-36), -Math.PI / 2, 4.4, 2.4);
    for (let i = 0; i < 5; i++) { PR.barrel(B, X(-38.2 + i * 1.0), Y(0), Z(-43.3), 0.9, true); if (i < 4) PR.barrel(B, X(-37.7 + i * 1.0), Y(0.78), Z(-43.3), 0.85, true); }
    for (const pz of [-28, -39]) {
      B.cyl('stone', X(-33.2), Y(0), Z(pz), 0.45, 0.55, CEIL, 12, { color: TRIM });
      B.cyl('stone', X(-33.2), Y(CEIL - 0.6), Z(pz), 0.8, 0.5, 0.6, 12, { color: TRIM, collide: false });
    }
    PR.table(B, X(-33), Y(0), Z(-33.6), Math.PI / 2, 2.2, 1.1, false);
    seat(PR.stool(B, X(-31.9), Y(0), Z(-33.2)));
    seat(PR.stool(B, X(-34.1), Y(0), Z(-34.2)));
    for (let i = 0; i < 3; i++) B.add('plain', new THREE.CylinderGeometry(1, 0.7, 1, 10), X(-33.2 + i * 0.2), Y(0.97), Z(-34.2 + i * 0.35), 0, 0, 0, 0.05, 0.1, 0.05, { color: C('#f0e8f8'), ao: false });
    B.add('plain', new THREE.CylinderGeometry(1, 1, 1, 8), X(-32.9), Y(1.0), Z(-33.1), 0, 0, 0, 0.03, 0.16, 0.03, { color: C('#fff6e6'), ao: false });
    B.add('lamp', new THREE.SphereGeometry(1, 8, 6), X(-32.9), Y(1.12), Z(-33.1), 0, 0, 0, 0.02, 0.045, 0.02, { ao: false });
    pick('c_wine1', 'wine', -33.3, 0.93, -32.9, { owner: 'crown' });
    pick('c_wine2', 'wine', -27.9, 0.72, -35.2, { owner: 'crown', ry: Math.PI / 2 });
    pick('c_wine3', 'wine', -38.6, 0.02, -24, { owner: 'crown' });
    book('b_cellarlog', 'cellarlog', -32.7, 0.93, -34.3, 0.4, { model: 'book', color: '#6a4a3a' });
    box('c_stash', 'Шатающийся камень в стене', -39.1, 0.5, -41.2, [['gold', [45, 70]], ['gem', 1], ['wine', 1]], { respawn: 1e9 });
    light(-33, 2.6, -33.4, 0xffc880, 7, 11);
    spawn.cellar = new THREE.Vector3(X(-33), Y(0), Z(-30));
    light(-33, 3.2, -25, 0xffc880, 5, 9);
    torch(-27.4, 2.4, -24.5, -Math.PI / 2);

    // --- dungeons (x -27..-14, z -44..-22)
    floor(-27, -14, -44, -22.4, 0, 'stone', '#a39aa6', 0.35);
    ribs(-27, -14, -44, -22, CEIL, true, DARK, 5.6);
    // cell blocks: bars along x=-22.5 and x=-18.5 from z=-27 to -44, dividers at -32.7 / -38.3
    const cellZ = [-29.85, -35.5, -41.15];
    for (const bx of [-22.5, -18.5]) {
      PR.bars(B, X(bx), Z(-27), X(bx), Z(-44), Y(0), 3.2, cellZ.map((cz) => ({ at: Math.abs(cz + 27), w: 1.3 })));
      B.box('stone', X(bx), Y(3.2), Z(-35.5), 0.45, CEIL - 3.2, 17, 0, { color: DARK });
    }
    for (const dz of [-27, -32.7, -38.3]) { iwall(-27, dz, -22.5, dz, 0, CEIL, [], { t: 0.5, color: DARK, frame: false }); iwall(-18.5, dz, -14, dz, 0, CEIL, [], { t: 0.5, color: DARK, frame: false }); }
    cellZ.forEach((cz, i) => {
      for (const [bx, side] of [[-22.5, -1], [-18.5, 1]]) {
        const prisoner = side > 0 && i === 1;
        door(bx, 0, cz, 0, 1.3, 3.1, { id: `cell_${side}_${i}`, style: 'bars', name: prisoner ? 'Камера Янека' : 'Камера', lock: prisoner || (i === 2 && side < 0) ? 'cell_key' : null, startOpen: !prisoner && !(i === 2 && side < 0) });
        const cx = side < 0 ? -24.75 : -16.25;
        PR.straw(B, X(cx + side * 1.2), Y(0), Z(cz - 1.2), 1.6, 1.2);
        PR.chains(B, X(side < 0 ? -26.7 : -14.3), Y(2.4), Z(cz + 1), side < 0 ? Math.PI / 2 : -Math.PI / 2);
        B.add('wood', new THREE.CylinderGeometry(1, 0.85, 1, 10), X(cx - side * 0.8), Y(0.2), Z(cz + 1.8), 0, 0, 0, 0.2, 0.4, 0.2, { color: C('#8a6246'), ao: false });
      }
    });
    box('d_straw', 'Солома в пустой камере', -25.9, 0.3, -42.3, [['gold', [8, 20]], ['potion_hp', 1], ['sweet_roll', 1, 0.5]], { respawn: 1e9 });
    book('b_scratches', 'scratches', -26.65, 1.4, -39.5, Math.PI / 2, { model: 'note' });
    // jailer post
    PR.table(B, X(-24.8), Y(0), Z(-24.6), Math.PI / 2, 1.8, 1.0, false);
    spawn.jailerSeat = seat(PR.chair(B, X(-25.9), Y(0), Z(-24.6), Math.PI / 2, {}));
    pick('j_key', 'cell_key', -24.6, 0.93, -24.2, { owner: 'jailer' });
    pick('j_roll', 'sweet_roll', -24.5, 0.93, -25.2, { owner: 'jailer' });
    book('b_guardcode', 'guardcode', -24.9, 0.93, -24.8, 0.3, { model: 'note' });
    PR.weaponRack(B, X(-14.5), Y(0), Z(-24.6), -Math.PI / 2, 2.6);
    torch(-26.7, 2.3, -23.4, Math.PI / 2);
    torch(-14.3, 2.3, -26.2, -Math.PI / 2);
    torch(-20.5, 2.3, -43.7, 0);
    light(-20.5, 3.2, -25, 0xff9a4a, 8, 11, { flicker: 0.1 });
    light(-20.5, 3.2, -40, 0xff8a4a, 6, 10, { flicker: 0.1 });
    spawn.prisoner = new THREE.Vector3(X(-15.7), Y(0), Z(-35.5));

    // ---------------- EAST: guard hall, armory, treasury ----------------
    iwall(14, -22, 39.4, -22, 0, CEIL, [{ at: 6.5, w: 2.0, h: 3.2 }, { at: 19, w: 2.0, h: 3.2 }], { t: 0.8 });
    iwall(27, -44, 27, -22.4, 0, CEIL, [], { t: 0.8 });
    door(20.5, 0, -22, Math.PI / 2, 2.0, 3.2, { id: 'armory', name: 'Оружейная' });
    door(33, 0, -22, Math.PI / 2, 2.0, 3.2, { id: 'treasury', name: 'Сокровищница', lock: 'treasury_key', color: '#7a5a8a', lockHint: 'Сокровищница заперта. Ключ хранится у принца Седрика.' });

    // --- guard hall (x 14..39.4, z -22..-10.6)
    floor(14, 39.4, -22, -10.6, 0, 'wood', '#c8a882', 0.3);
    beams(14, 39.4, -22, -10.6, CEIL);
    PR.fireplace(B, X(38.9), Y(0), Z(-16.3), -Math.PI / 2, 3.6, lamps, fires.big, { hood: 3.2 });
    light(37.6, 1.4, -16.3, 0xff9a4a, 14, 13, { flicker: 0.12 });
    light(26, 4.2, -16.3, 0xffd8a0, 10, 16);
    PR.table(B, X(24), Y(0), Z(-16.3), 0, 6, 1.3, true);
    PR.bench(B, X(24), Y(0), Z(-17.3), Math.PI / 2, 5.6);
    PR.bench(B, X(24), Y(0), Z(-15.3), Math.PI / 2, 5.6);
    const guardSeats = [];
    for (const dx of [-2.2, -0.7, 0.8, 2.3]) { guardSeats.push(seat({ t: 'seat', x: X(24 + dx), y: Y(0), z: Z(-17.3), face: 0, h: 0.5 })); guardSeats.push(seat({ t: 'seat', x: X(24 + dx), y: Y(0), z: Z(-15.3), face: Math.PI, h: 0.5 })); }
    spawn.guardSeats = guardSeats;
    // map table
    PR.table(B, X(33), Y(0), Z(-13.4), 0, 2.4, 1.6, false);
    B.box('plain', X(33), Y(0.92), Z(-13.4), 2.1, 0.01, 1.3, 0.05, { color: C('#f2e6c8'), collide: false, ao: false });
    for (let i = 0; i < 9; i++) B.add('plain', new THREE.CylinderGeometry(1, 1, 1, 10), X(32.2 + (i % 3) * 0.6 + Math.sin(i) * 0.1), Y(0.93), Z(-13.8 + Math.floor(i / 3) * 0.35), 0, 0, 0, 0.1 + (i % 2) * 0.08, 0.004, 0.08 + (i % 3) * 0.05, { color: C(['#9ac878', '#7ab0d8', '#e8a8c8'][i % 3]), ao: false });
    for (const [fx, fz, c] of [[32.4, -13.2, '#e05a6a'], [33.6, -13.7, '#6f7fd8'], [33.2, -13.1, '#f0c860']]) { B.add('plain', new THREE.ConeGeometry(1, 1, 6), X(fx), Y(1.0), Z(fz), 0, 0, 0, 0.04, 0.14, 0.04, { color: C(c), ao: false }); }
    pick('g_potion', 'potion_stamina', 34, 0.93, -12.9, { owner: 'guard' });
    for (const [wx, w] of [[16.6, 3.2], [24.3, 3.6], [29.7, 3.4]]) PR.weaponRack(B, X(wx), Y(0), Z(-21.3), 0, w);
    [[16.5, '#6f7fd8'], [20.5, '#e89ac0'], [34.5, '#f4f0ff'], [37.5, '#6fb3c6']].forEach(([sx, c]) => PR.shield(B, X(sx), Y(2.7), Z(-10.95), Math.PI, c));
    PR.tapestry(B, X(31), Y(5.0), Z(-10.95), Math.PI / 2, 2.6, 2.6, '#6f7fd8', '#f0c860');
    const lg = PR.lectern(B, X(36.8), Y(0), Z(-20.6), 0);
    book('b_blade', 'bladecraft', 36.8, lg.y - Y(0), -20.6, 0);
    box('g_chest', 'Сундук гвардейцев', 15, 0.5, -11.5, [['gold', [10, 25]], ['bread', 1], ['potion_hp', 1, 0.4]], { owner: 'guard', respawn: 2400 });
    PR.crate(B, X(15), Y(0), Z(-11.5), 0.9, 0.1);
    torch(14.3, 2.4, -14, Math.PI / 2);
    torch(14.3, 2.4, -19, Math.PI / 2);

    // --- armory (x 14..27, z -44..-22)
    floor(14, 27, -44, -22.4, 0, 'stone', '#d8ccbe', 0.35);
    ribs(14, 27, -44, -22, CEIL, true, TRIM, 4.4);
    for (const rz of [-26, -31.5, -37]) PR.weaponRack(B, X(14.6), Y(0), Z(rz), Math.PI / 2, 3.6);
    PR.armorStand(B, X(25.6), Y(0), Z(-26.5), -Math.PI / 2, '#f4f6fc');
    PR.armorStand(B, X(25.6), Y(0), Z(-30.5), -Math.PI / 2, '#d6dde8', '#9fb8e8');
    PR.armorStand(B, X(25.6), Y(0), Z(-34.5), -Math.PI / 2, '#f7df9a', '#fff0c8');
    ['#6f7fd8', '#e89ac0', '#f4f0ff', '#f0c860'].forEach((c, i) => PR.shield(B, X(16.5 + i * 2.6), Y(2.6), Z(-43.65), 0, c));
    PR.grindstone(B, X(22), Y(0), Z(-41.5), 0);
    B.box('iron', X(18.5), Y(0), Z(-41.8), 0.7, 0.75, 0.45, 0, { color: C('#555a66') });
    B.box('iron', X(18.5), Y(0.75), Z(-41.8), 1.3, 0.3, 0.55, 0, { color: C('#6a6f7c') });
    PR.table(B, X(21), Y(0), Z(-33), Math.PI / 2, 2.4, 1.1, false);
    pick('a_sword', 'iron_sword', 21, 0.93, -33.4, { owner: 'crown', ry: Math.PI / 2 });
    pick('a_potion', 'potion_hp', 20.8, 0.93, -32.2, { owner: 'crown' });
    PR.crate(B, X(15.2), Y(0), Z(-42.8), 1.0, 0);
    box('a_chest', 'Оружейный сундук', 15.2, 0.6, -42.8, [['gold', [15, 30]], ['potion_stamina', 1]], { owner: 'crown', respawn: 3000 });
    torch(26.6, 2.4, -24, -Math.PI / 2);
    torch(20.5, 2.4, -43.7, 0);
    light(20.5, 3.4, -30, 0xffb070, 10, 13, { flicker: 0.06 });

    // --- treasury (x 27..39.4, z -44..-22)
    floor(27.4, 39.4, -44, -22.4, 0, 'marble', '#ffffff', 0.14);
    ribs(27, 39.4, -44, -22, CEIL, true, C('#f0e2c4'), 4.4);
    PR.crownDisplay(B, X(33.2), Y(0), Z(-35));
    PR.goldPile(B, X(29.3), Y(0), Z(-41.8), 1.0);
    PR.goldPile(B, X(37.6), Y(0), Z(-42), 1.2);
    PR.goldPile(B, X(38.2), Y(0), Z(-27), 0.8);
    PR.openChest(B, X(29), Y(0), Z(-28), Math.PI / 2);
    PR.openChest(B, X(37.8), Y(0), Z(-37), -Math.PI / 2);
    for (const [px, pz, k] of [[30, -33], [36.4, -33], [30, -38], [36.4, -38]].map((p, i) => [...p, i])) {
      B.cyl('stone', X(px), Y(0), Z(pz), 0.28, 0.34, 1.05, 10, { color: C('#f4efe8') });
      B.add(k % 2 ? 'crystalPink' : 'crystal', new THREE.OctahedronGeometry(1, 0), X(px), Y(1.35), Z(pz), 0, k, 0, 0.14, 0.24, 0.14, { ao: false, worldUV: false });
    }
    B.cyl('stone', X(33.2), Y(0), Z(-42.4), 0.4, 0.46, 1.05, 12, { color: C('#f4efe8') });
    B.box('fabric', X(33.2), Y(1.05), Z(-42.4), 0.55, 0.1, 0.55, 0, { color: C('#6f7fd8'), collide: false });
    pick('t_amulet', 'heart_amulet', 33.2, 1.16, -42.4, { model: 'ring', color: '#ff9ecb' });
    pick('t_gem', 'gem', 36.4, 1.08, -33, {});
    box('t_chest', 'Сундук казны', 29, 0.6, -28, [['gold', [180, 260]], ['silver_ring', 1], ['gem', 1]], { respawn: 1e9 });
    PR.painting(B, X(27.45), Y(3.2), Z(-30), Math.PI / 2, 1.3, 1.7, 'portrait');
    PR.painting(B, X(27.45), Y(3.2), Z(-38), Math.PI / 2, 1.3, 1.7, 'portrait');
    light(33.2, 3.8, -34, 0xffd070, 12, 14);
    book('b_crown', 'crownlaw', 36.4, 1.08, -38, 0, { model: 'book', color: '#6f3a5a' });
  }

  // lore books left around the older rooms
  function lore() {
    book('b_chronicle', 'chronicle', -5.9, 17.93, -55.2, 0.3, { model: 'openbook', color: '#8a4a5a' });
    book('b_bestiary', 'bestiary', -6.1, 17.93, -56.5, -0.2, { model: 'book', color: '#4a6a8a' });
    book('b_herbal', 'herbal', -60, 1.12, 3.6, 0.4, { model: 'openbook', color: '#6a9a4a' });
    book('b_stars', 'stars', -5.2, 75.02, -44.2, 0.4, { model: 'openbook', color: '#4a5a9a' });
  }

  // ====================================================================
  // ROYAL WING — banquet hall / chambers with balconies / roof garden
  // ====================================================================
  function royalWing() {
    const TH = K.TH;
    const F1 = TH, F2 = TH + 5.5, F3 = TH + 11;
    const cx = 31, cz = -49;
    K.building(cx, cz, 18, 14, 5.5, 0, { y0: F1, doors: [{ side: 's', at: 0, w: 2.6, h: 3.8 }], roofType: 'none', ceiling: false, floorMat: 'marble', floorColor: C('#ffffff'), wallColor: WHITE });
    K.building(cx, cz, 18, 14, 5.5, 0, { y0: F2, doors: [{ side: 's', at: -1.8, w: 1.6, h: 3 }, { side: 's', at: 4.2, w: 1.6, h: 3 }], roofType: 'none', ceiling: false, floor: false, wallColor: WHITE, flowerWindows: true });
    // cornices between floors
    for (const [y, t] of [[F2 - 0.2, 0.4], [F3 - 0.3, 0.5]]) {
      B.box('stone', X(cx), Y(y), Z(-42 + 0.1), 18.8, t, 0.5, 0, { color: TRIM, collide: false });
      B.box('stone', X(cx), Y(y), Z(-56 - 0.1), 18.8, t, 0.5, 0, { color: TRIM, collide: false });
      B.box('stone', X(40.1), Y(y), Z(cz), 0.5, t, 14.6, 0, { color: TRIM, collide: false });
      B.box('stone', X(21.9), Y(y), Z(cz), 0.5, t, 14.6, 0, { color: TRIM, collide: false });
    }
    // floor slabs
    B.box('stone', X(31), Y(F2 - 0.4), Z(-54.1), 17.4, 0.4, 3.2, 0, { color: TRIM, walkable: true });
    B.box('stone', X(33.85), Y(F2 - 0.4), Z(-47.4), 11.7, 0.4, 10.2, 0, { color: TRIM, walkable: true });
    floor(28, 39.7, -55.7, -42.3, F2, 'wood', '#d8b890', 0.3);
    floor(22.3, 28, -55.7, -52.5, F2, 'wood', '#d8b890', 0.3);
    B.box('stone', X(31), Y(F3 - 0.4), Z(-54.25), 18, 0.4, 3.5, 0, { color: TRIM, walkable: true });
    B.box('stone', X(34), Y(F3 - 0.4), Z(-47.25), 12, 0.4, 10.5, 0, { color: TRIM, walkable: true });
    B.box('stone', X(25), Y(F3 - 0.4), Z(-42.75), 6, 0.4, 1.5, 0, { color: TRIM, walkable: true });
    floor(22, 40, -56, -52.5, F3, 'cobble', '#f4ede6', 0.18);
    floor(28, 40, -52.5, -42, F3, 'cobble', '#f4ede6', 0.18);
    floor(22, 28, -43.5, -42, F3, 'cobble', '#f4ede6', 0.18);
    // stair hall (west, x 22.3..28): switchback stairs
    K.stairs(23.55, -48, 2.5, 9, F1, F2, 0, { color: WHITE });
    K.stairs(26.62, -48, 2.35, 9, F2, F3, Math.PI, { rails: true, color: WHITE });
    iwall(28, -42.3, 28, -55.7, F1, 5.5, [{ at: 2.7, w: 2.0, h: 3.2 }], { t: 0.5, color: WHITE });
    iwall(28, -42.3, 28, -55.7, F2, 5.1, [{ at: 11.8, w: 1.8, h: 3.0 }], { t: 0.5, color: WHITE });
    door(28, F1, -45, 0, 2.0, 3.2, { id: 'rw_stairs1', name: 'Лестница', color: '#b08a60' });
    door(28, F2, -54.1, 0, 1.8, 3.0, { id: 'rw_stairs2', name: 'Галерея покоев', color: '#b08a60' });
    balustrade(22.3, -43.5, 25.3, -43.5, F3);
    balustrade(28, -52.5, 28, -43.5, F3);
    balustrade(22.3, -52.5, 28, -52.5, F3);
    PR.painting(B, X(22.35), Y(F1 + 2.6), Z(-54), Math.PI / 2, 1.4, 1.0, 'land');
    PR.chandelier(B, X(25.2), Y(F2 + 3.8), Z(-48), 0.7, lamps, F3 - 0.4);
    light(25.2, F2 + 1.5, -48, 0xffe0b0, 10, 16);

    door(29.7, F1, -42, Math.PI / 2, 1.3, 3.7, { id: 'rw_mainL', name: 'Королевское крыло', color: '#f2e8dc' });
    door(32.3, F1, -42, -Math.PI / 2, 1.3, 3.7, { id: 'rw_mainR', name: 'Королевское крыло', color: '#f2e8dc' });
    PR.wallLantern(B, X(28.6), Y(F1 + 2.8), Z(-41.7), -Math.PI / 2, lamps);
    PR.wallLantern(B, X(33.4), Y(F1 + 2.8), Z(-41.7), -Math.PI / 2, lamps);
    // --- F1 banquet hall (x 28.3..39.7)
    PR.rug(B, X(34), Y(F1), Z(-48.8), 0, 4.2, 10.5, '#b8407a', '#f0c860');
    PR.table(B, X(34), Y(F1), Z(-48.6), Math.PI / 2, 8.2, 1.7, true);
    B.box('fabric', X(34), Y(F1 + 0.87), Z(-48.6), 1.85, 0.02, 8.4, 0, { color: C('#fbf6ee'), collide: false, ao: false });
    B.box('fabric', X(34), Y(F1 + 0.89), Z(-48.6), 0.6, 0.02, 8.5, 0, { color: C('#e89ac0'), collide: false, ao: false });
    for (const tz of [-51.5, -48.6, -45.7]) PR.candelabra(B, X(34), Y(F1 + 0.9), Z(tz), lamps, 0.55);
    for (const tz of [-52, -50.4, -48.8, -47.2, -45.6]) {
      seat(PR.chair(B, X(32.6), Y(F1), Z(tz), Math.PI / 2, { cushion: '#c94f7c' }));
      seat(PR.chair(B, X(35.4), Y(F1), Z(tz), -Math.PI / 2, { cushion: '#c94f7c' }));
    }
    seat(PR.chair(B, X(34), Y(F1), Z(-53.6), 0, { cushion: '#b8407a', high: true, color: '#8a5a3a' }));
    PR.fireplace(B, X(38), Y(F1), Z(-55.25), 0, 3.0, lamps, fires.big, { hood: 2.4 });
    light(38, F1 + 1.3, -54.3, 0xff9a4a, 12, 12, { flicker: 0.1 });
    PR.chandelier(B, X(34), Y(F1 + 4.1), Z(-50.6), 1.1, lamps, F2 - 0.4);
    PR.chandelier(B, X(34), Y(F1 + 4.1), Z(-46.2), 1.1, lamps, F2 - 0.4);
    light(34, F1 + 3.6, -48.4, 0xffe0b0, 16, 17);
    PR.tapestry(B, X(39.65), Y(F1 + 4.7), Z(-48.5), Math.PI, 2.6, 3.8, '#c94f7c', '#f0c860');
    PR.painting(B, X(30.2), Y(F1 + 2.8), Z(-55.6), 0, 1.5, 1.9, 'portrait');
    PR.painting(B, X(39.6), Y(F1 + 2.6), Z(-44), -Math.PI / 2, 1.2, 1.5, 'portrait');
    PR.wardrobe(B, X(29.2), Y(F1), Z(-55.3), 0, 1.6, 1.4, '#b08a60'); // sideboard
    for (let i = 0; i < 4; i++) B.add('plain', new THREE.CylinderGeometry(1, 1, 1, 12), X(28.7 + i * 0.35), Y(F1 + 1.5), Z(-55.25), 0, 0, 0, 0.14, 0.02, 0.14, { color: C('#f4efe6'), ao: false });
    PR.vase(B, X(29.2), Y(F1 + 1.5), Z(-55.3), '#ff8ac8');
    PR.pottedTree(B, X(28.9), Y(F1), Z(-43.1), 'blossom');
    PR.pottedTree(B, X(38.8), Y(F1), Z(-43.2), 'lemon');
    pick('rw_wine', 'wine', 33.6, F1 + 0.95, -50.2, { owner: 'crown' });
    pick('rw_pie', 'honey_pie', 34.4, F1 + 0.95, -47.8, { owner: 'crown', model: 'bread' });
    pick('rw_cheese', 'cheese', 34.3, F1 + 0.95, -52.1, { owner: 'crown' });
    spawn.servant = new THREE.Vector3(X(37.5), Y(F1), Z(-44.5));

    // --- F2: corridor (z -55.7..-52.9) + two chambers
    iwall(28.25, -52.9, 39.7, -52.9, F2, 5.1, [{ at: 1.15, w: 1.3, h: 2.6 }, { at: 8.75, w: 1.3, h: 2.6 }], { t: 0.3, color: C('#f6eee6') });
    iwall(34.2, -52.75, 34.2, -42.3, F2, 5.1, [], { t: 0.3, color: C('#f6eee6'), frame: false });
    door(29.4, F2, -52.9, Math.PI / 2, 1.3, 2.6, { id: 'rw_aurelia', name: 'Покои принцессы', color: '#e8d8e8' });
    door(37, F2, -52.9, Math.PI / 2, 1.3, 2.6, { id: 'rw_cedric', name: 'Покои принца', color: '#b8c8e8' });
    PR.rug(B, X(34), Y(F2), Z(-54.3), Math.PI / 2, 1.6, 10.5, '#6f7fd8', '#f0c860');
    PR.painting(B, X(33.2), Y(F2 + 2.1), Z(-55.65), 0, 1.4, 1.0, 'land');
    PR.painting(B, X(39.65), Y(F2 + 2.1), Z(-54.3), -Math.PI / 2, 0.9, 1.2, 'portrait');
    PR.table(B, X(31.4), Y(F2), Z(-55.25), 0, 1.0, 0.5, false);
    PR.vase(B, X(31.4), Y(F2 + 0.9), Z(-55.25), '#e8409a');
    light(33.5, F2 + 3.2, -54.3, 0xffd8b0, 6, 9);
    // princess Aurelia's chamber (x 28.3..34.2)
    PR.rug(B, X(31.2), Y(F2), Z(-47.5), 0, 3.2, 4.2, '#f7b7d2', '#fff0c8');
    PR.bed(B, X(32.4), Y(F2), Z(-51.35), 0, { w: 1.7, len: 2.3, canopy: '#f7b7d2', blanket: '#fbd0e2', frame: '#f2e8dc' });
    bed(32.4, F2, -50.9, { royal: true });
    PR.vanity(B, X(33.85), Y(F2), Z(-47.2), -Math.PI / 2);
    seat(PR.chair(B, X(33.1), Y(F2), Z(-47.2), Math.PI / 2, { cushion: '#f7b7d2', color: '#f2e8dc' }));
    PR.wardrobe(B, X(28.65), Y(F2), Z(-48.6), Math.PI / 2, 1.6, 2.3, '#f2e8dc');
    PR.table(B, X(31.8), Y(F2), Z(-43.6), 0, 1.3, 0.8, false);
    seat(PR.chair(B, X(31.8), Y(F2), Z(-44.45), 0, { cushion: '#f7b7d2', color: '#f2e8dc' }));
    book('b_aurelia', 'aurelia', 31.7, F2 + 0.93, -43.6, 0.2, { model: 'openbook', color: '#e89ac0' });
    PR.vase(B, X(32.3), Y(F2 + 0.9), Z(-43.4), '#ff8ac8');
    PR.vase(B, X(33.7), Y(F2 + 0.85), Z(-45.8), '#ffffff');
    PR.painting(B, X(28.35), Y(F2 + 2.3), Z(-45.8), Math.PI / 2, 1.0, 0.8, 'sea');
    light(31.2, F2 + 3.4, -47.5, 0xffd8e8, 8, 10);
    spawn.aurelia = new THREE.Vector3(X(31), Y(F2), Z(-45.8));
    // prince Cedric's chamber (x 34.2..39.7)
    PR.rug(B, X(37), Y(F2), Z(-47.5), 0, 3.2, 4.2, '#6f7fd8', '#f0c860');
    PR.bed(B, X(38.6), Y(F2), Z(-51.35), 0, { w: 1.5, len: 2.3, canopy: '#8fa8e8', blanket: '#6f7fd8', frame: '#6a4a36' });
    bed(38.6, F2, -50.9, { royal: true });
    PR.armorStand(B, X(35.1), Y(F2), Z(-51.8), Math.PI / 2 + 0.4, '#f4f6fc', '#9fb8e8');
    PR.weaponRack(B, X(34.7), Y(F2), Z(-47.6), Math.PI / 2, 2.4);
    PR.table(B, X(38.4), Y(F2), Z(-44.2), Math.PI / 2, 1.6, 0.9, false);
    seat(PR.chair(B, X(37.4), Y(F2), Z(-44.2), Math.PI / 2, { cushion: '#6f7fd8' }));
    B.box('plain', X(38.4), Y(F2 + 0.92), Z(-44.2), 0.7, 0.01, 1.1, 0.1, { color: C('#f2e6c8'), collide: false, ao: false });
    book('b_cedric', 'cedric', 38.5, F2 + 0.93, -44.6, 0.2, { model: 'book', color: '#4a5a9a' });
    PR.shield(B, X(39.65), Y(F2 + 2.4), Z(-47.5), -Math.PI / 2, '#6f7fd8');
    light(37, F2 + 3.4, -47.5, 0xffe0c0, 8, 10);
    spawn.cedricRoom = new THREE.Vector3(X(36.6), Y(F2), Z(-46.5));
    // balconies with bougainvillea
    for (const bx of [29.2, 35.2]) {
      B.box('stone', X(bx), Y(F2 - 0.45), Z(-40.8), 3.0, 0.45, 2.4, 0, { color: TRIM, walkable: true });
      for (const sd of [-1, 1]) B.add('stone', new THREE.BoxGeometry(1, 1, 1), X(bx + sd * 1.1), Y(F2 - 1.1), Z(-41.5), 0, 0, 0, 0.35, 0.9, 1.0, { color: TRIM });
      balustrade(bx - 1.45, -41.9, bx - 1.45, -39.65, F2);
      balustrade(bx + 1.45, -41.9, bx + 1.45, -39.65, F2);
      balustrade(bx - 1.45, -39.65, bx + 1.45, -39.65, F2);
      PR.bougainvillea(B, X(bx), Y(F2 + 0.9), Z(-39.55), -Math.PI / 2, 3.2, 2.6, 1.2);
      for (const sd of [-1, 1]) B.box('fabric', X(bx + sd * 0.95), Y(F2), Z(-42.25), 0.35, 3.1, 0.05, 0, { color: C(bx < 32 ? '#fbd0e2' : '#c8d4f5'), collide: false, ao: false });
      PR.vase(B, X(bx + 1.1), Y(F2), Z(-40), '#ff8ac8');
    }
    // cascades over the south facade from the roof parapet
    for (const [bx, w, h] of [[23.5, 2.6, 6.5], [32.2, 2.2, 4.5], [38.6, 2.6, 7.5]]) PR.bougainvillea(B, X(bx), Y(F3 + 0.4), Z(-41.85), -Math.PI / 2, w, h, 1.1);
    PR.bougainvillea(B, X(40.05), Y(F3 + 0.4), Z(-47), 0, 5, 5.5, 1.0);

    // --- F3 roof garden
    balustrade(22, -56, 40, -56, F3);
    balustrade(40, -56, 40, -42, F3);
    balustrade(22, -42, 40, -42, F3);
    balustrade(22, -56, 22, -42, F3);
    PR.pergola(B, X(35), Y(F3), Z(-49), 0, 7, 4.6, 2.8);
    PR.bench(B, X(35), Y(F3), Z(-50.6), Math.PI / 2, 2.4);
    PR.bench(B, X(35), Y(F3), Z(-47.4), Math.PI / 2, 2.4);
    for (const dx of [-0.6, 0.6]) { seat({ t: 'seat', x: X(35 + dx), y: Y(F3), z: Z(-50.6), face: 0, h: 0.5 }); seat({ t: 'seat', x: X(35 + dx), y: Y(F3), z: Z(-47.4), face: Math.PI, h: 0.5 }); }
    K.flowerBox(31, -55.2, F3, 4, 1.2);
    K.flowerBox(39.2, -45, F3, 1.2, 4);
    // little fountain
    B.cyl('stone', X(25.2), Y(F3), Z(-54.2), 1.1, 1.2, 0.55, 20, { color: TRIM });
    B.add('crystal', new THREE.CylinderGeometry(1, 1, 1, 20), X(25.2), Y(F3 + 0.5), Z(-54.2), 0, 0, 0, 0.95, 0.04, 0.95, { color: C('#bfe4ff'), ao: false });
    B.cyl('stone', X(25.2), Y(F3 + 0.5), Z(-54.2), 0.12, 0.16, 0.9, 8, { color: WHITE, collide: false });
    B.add('crystalPink', new THREE.OctahedronGeometry(1, 0), X(25.2), Y(F3 + 1.6), Z(-54.2), 0, 0, 0, 0.18, 0.3, 0.18, { ao: false, worldUV: false });
    PR.roses(B, X(39.8), Y(F3), Z(-53.5), Math.PI, 3, 1.6, '#e8487a');
    PR.pottedTree(B, X(30), Y(F3), Z(-43.2), 'blossom');
    PR.pottedTree(B, X(38.8), Y(F3), Z(-54.8), 'lavender');
    for (const [lx, lz] of [[28.4, -55.3], [39.3, -42.7]]) { B.cyl('iron', X(lx), Y(F3), Z(lz), 0.05, 0.07, 1.9, 6, { color: C('#555a66'), collide: false }); B.box('lamp', X(lx), Y(F3 + 1.9), Z(lz), 0.26, 0.34, 0.26, 0, { collide: false }); lamps.push(new THREE.Vector3(X(lx), Y(F3 + 2.05), Z(lz))); }
    pick('rw_rose', 'royal_rose', 39.2, F3 + 0.05, -52.8, { cond: (g) => g.quests.active('letter') && g.quests.stage('letter') === 3 && !g.state.flags.letter_report });
    book('b_loveletter', 'loveletter', 35.2, F3 + 0.5, -47.4, 0, { model: 'note', cond: (g) => g.quests.active('letter') && g.quests.stage('letter') <= 1 });
    light(34, F3 + 2.2, -49, 0xffd8f0, 6, 12, { cond: (g) => g.sky.isNight() });
    spawn.roofGarden = new THREE.Vector3(X(33.5), Y(F3), Z(-45.5));
  }

  // ====================================================================
  // TAVERN — guest floor reached by an outside staircase
  // ====================================================================
  function tavernUpper() {
    const U = 4.2;
    B.box('wood', X(-58), Y(U - 0.3), Z(26.65), 19.4, 0.3, 8.7, 0, { color: C('#a47650'), walkable: true });
    for (let x = -67; x < -48; x += 2.2) B.box('wood', X(x), Y(U - 0.62), Z(26.65), 0.24, 0.32, 8.7, 0, { color: C('#7a5238'), collide: false, ao: false });
    B.box('wood', X(-58), Y(U - 0.62), Z(31.05), 19.4, 0.34, 0.3, 0, { color: C('#7a5238'), collide: false, ao: false });
    floor(-67.7, -48.3, 22.3, 31, U, 'wood', '#c8a47a', 0.3);
    B.box('wood', X(-58), Y(U + 3.75), Z(26.65), 19.4, 0.1, 8.7, 0, { color: C('#b8906a'), collide: false, ao: false }); // plank ceiling
    for (let x = -66.6; x < -48; x += 2.2) B.box('wood', X(x), Y(U + 3.55), Z(26.65), 0.2, 0.2, 8.7, 0, { color: C('#7a5238'), collide: false, ao: false });
    iwall(-67.7, 24.5, -48.3, 24.5, U, 3.8, [{ at: 3.25, w: 1.1, h: 2.3 }, { at: 9.75, w: 1.1, h: 2.3 }, { at: 16.2, w: 1.1, h: 2.3 }], { t: 0.25, mat: 'wood', color: C('#c9a27a') });
    iwall(-61.2, 24.62, -61.2, 31, U, 3.8, [], { t: 0.25, mat: 'wood', color: C('#c9a27a'), frame: false });
    iwall(-54.7, 24.62, -54.7, 31, U, 3.8, [], { t: 0.25, mat: 'wood', color: C('#c9a27a'), frame: false });
    iwall(-67.7, 31, -48.3, 31, U, 3.8, [], { t: 0.3, color: PLASTER, frame: false });
    door(-64.45, U, 24.5, Math.PI / 2, 1.1, 2.3, { id: 'tv_r1', name: 'Комната Гюнтера', color: '#a47650' });
    door(-57.95, U, 24.5, Math.PI / 2, 1.1, 2.3, { id: 'tv_r2', name: 'Комната Флориана', color: '#a47650' });
    door(-51.5, U, 24.5, Math.PI / 2, 1.1, 2.3, { id: 'tv_r3', name: 'Комната для гостей', color: '#a47650' });
    // outside stair + landing (north wall)
    K.stairs(-57.5, 20, 2.6, 9, 0, U, -Math.PI / 2, { rails: true, mat: 'wood', color: C('#a47650') });
    B.box('wood', X(-51.3), Y(U - 0.3), Z(20.2), 3.4, 0.3, 3.0, 0, { color: C('#a47650'), walkable: true });
    for (const [px, pz] of [[-52.8, 18.9], [-49.8, 18.9]]) B.box('wood', X(px), Y(0), Z(pz), 0.22, U - 0.3, 0.22, 0, { color: C('#7a5238') });
    balustrade(-53, 18.75, -49.6, 18.75, U);
    balustrade(-49.65, 18.75, -49.65, 21.6, U);
    B.gable('roof', X(-51.3), Y(U + 2.7), Z(20.2), 3.2, 1.2, 3.6, 0, { color: C('#e59bb5') });
    for (const [px, pz] of [[-52.8, 18.9], [-49.8, 18.9]]) B.box('wood', X(px), Y(U), Z(pz), 0.14, 2.7, 0.14, 0, { color: C('#7a5238'), collide: false });
    PR.wallLantern(B, X(-50.1), Y(U + 1.9), Z(21.7), Math.PI, lamps);
    door(-51.3, U, 22, Math.PI / 2, 1.5, 2.6, { id: 'tv_upper', name: 'Комнаты для постояльцев', color: '#a47650' });
    // upper windows
    for (const [x, z, ry] of [[-68.33, 27.7, 0], [-47.67, 27.7, 0], [-64, 21.67, Math.PI / 2], [-58.5, 21.67, Math.PI / 2]]) PR.archWindow(B, X(x), Y(U + 1.1), Z(z), ry, 0.9, 1.4, { flowers: 0 });
    // corridor
    PR.rug(B, X(-58), Y(U), Z(23.4), Math.PI / 2, 1.2, 17, '#b8407a', '#e8c070');
    PR.painting(B, X(-60.5), Y(U + 1.9), Z(22.35), 0, 1.1, 0.8, 'land');
    light(-58, U + 3.1, 23.4, 0xffc880, 6, 10);
    PR.wallLantern(B, X(-66), Y(U + 2.2), Z(22.3), Math.PI / 2, lamps);
    // room 1: Gunter's own room (x -67.7..-61.2)
    PR.bed(B, X(-66.6), Y(U), Z(29.75), Math.PI, { w: 1.5, len: 2.1, blanket: '#e8b060' });
    bed(-66.6, U, 29.6, { owner: 'Гюнтера' });
    PR.crate(B, X(-62), Y(U), Z(30.2), 0.8, 0.1);
    box('tv_strongbox', 'Сундучок Гюнтера', -62, U + 0.5, 30.2, [['gold', [25, 45]], ['wine', 1]], { owner: 'tavern', respawn: 3000 });
    for (const [bx, bz] of [[-66.9, 25.3], [-66.1, 25.3]]) PR.barrel(B, X(bx), Y(U), Z(bz), 0.8);
    PR.wardrobe(B, X(-62.2), Y(U), Z(26.8), -Math.PI / 2, 1.3, 2.0, '#8a5c3b');
    light(-64.4, U + 2.8, 27.8, 0xffc880, 4, 7);
    // room 2: Florian the bard (x -61.2..-54.7)
    PR.bed(B, X(-60.1), Y(U), Z(29.75), Math.PI, { w: 1.3, len: 2.1, blanket: '#b9a3e3' });
    bed(-60.1, U, 29.6, { owner: 'Флориана' });
    PR.table(B, X(-56.1), Y(U), Z(29.6), Math.PI / 2, 1.3, 0.8, false);
    seat(PR.chair(B, X(-57), Y(U), Z(29.6), Math.PI / 2, {}));
    book('b_florian', 'florian', -56.1, U + 0.93, 29.8, 0.3, { model: 'openbook', color: '#8a5ab8' });
    for (let i = 0; i < 4; i++) B.box('plain', X(-56.4 + (i % 2) * 0.35), Y(U + 0.93), Z(29.1 + i * 0.12), 0.2, 0.004, 0.28, i * 0.4, { color: C('#fbf3df'), collide: false, ao: false });
    B.add('plain', new THREE.CylinderGeometry(1, 1, 1, 8), X(-55.8), Y(U + 1.0), Z(30.1), 0, 0, 0, 0.03, 0.15, 0.03, { color: C('#fff6e6'), ao: false });
    B.add('lamp', new THREE.SphereGeometry(1, 8, 6), X(-55.8), Y(U + 1.12), Z(30.1), 0, 0, 0, 0.02, 0.045, 0.02, { ao: false });
    pick('tv_lute', 'lute', -60.4, U + 0.02, 26.4, { cond: () => false });
    PR.vase(B, X(-55.2), Y(U), Z(25.2), '#ff8ac8');
    light(-57.9, U + 2.8, 27.8, 0xffc880, 4, 7);
    // room 3: guest room for rent (x -54.7..-48.3)
    PR.bed(B, X(-49.5), Y(U), Z(29.75), Math.PI, { w: 1.5, len: 2.1, blanket: '#9fd0f2' });
    bed(-49.5, U, 29.6, { rent: true });
    PR.rug(B, X(-51.5), Y(U), Z(27.4), 0, 2.2, 2.2, '#9fd0f2', '#f0c860');
    PR.table(B, X(-53.6), Y(U), Z(29.9), 0, 1.0, 0.7, false);
    seat(PR.chair(B, X(-53.6), Y(U), Z(29.1), 0, {}));
    B.add('plain', new THREE.CylinderGeometry(1, 1, 1, 8), X(-53.6), Y(U + 0.95), Z(30.0), 0, 0, 0, 0.03, 0.14, 0.03, { color: C('#fff6e6'), ao: false });
    B.add('lamp', new THREE.SphereGeometry(1, 8, 6), X(-53.6), Y(U + 1.07), Z(30.0), 0, 0, 0, 0.02, 0.045, 0.02, { ao: false });
    PR.crate(B, X(-49.1), Y(U), Z(25.3), 0.7, 0);
    pick('tv_apple', 'apple', -53.4, U + 0.93, 29.8, {});
    light(-51.5, U + 2.8, 27.8, 0xffc880, 5, 7);
    // tavern hall: seats on the existing benches
    for (const [tx, tz] of [[-55, 24.5], [-55, 35], [-51, 24.5]]) for (const dz of [-0.55, 0.55]) {
      seat({ t: 'seat', x: X(tx - 1.0), y: Y(0), z: Z(tz + dz), face: Math.PI / 2, h: 0.5 });
      seat({ t: 'seat', x: X(tx + 1.0), y: Y(0), z: Z(tz + dz), face: -Math.PI / 2, h: 0.5 });
    }
    spawn.florian = new THREE.Vector3(X(-54.5), Y(0), Z(31.5));
  }

  // ====================================================================
  // HOUSES — four enterable homes with sleeping lofts
  // ====================================================================
  function houses() {
    const list = [
      { x: -52, z: 56, id: 'h_anna', who: 'семьи Нелли', blanket: '#ffc6dc', hearth: 1, kind: 'family' },
      { x: -36, z: 57, id: 'h_tobias', who: 'Тобиаса', blanket: '#9fb8e8', hearth: 1, kind: 'soldier' },
      { x: 36, z: 57, id: 'h_liza', who: 'Лизы', blanket: '#c7a6f0', hearth: 1, kind: 'weaver' },
      { x: 52, z: 56, id: 'h_otto', who: 'Отто', blanket: '#f2d98a', hearth: 1, kind: 'baker' },
    ];
    spawn.houses = {};
    for (const h of list) {
      const { x, z } = h;
      const L = (lx, lz) => [x + lx, z + lz];
      door(x, 0, z - 4, Math.PI / 2, 1.8, 2.8, { id: h.id + '_door', name: `Дом ${h.who}`, color: '#8a5c3b' });
      floor(x - 5.2, x + 5.2, z - 3.7, z + 3.7, 0, 'wood', '#c8a47a', 0.3);
      // loft over the south half + stair along the west wall
      B.box('wood', X(x), Y(2.8), Z(z + 2.05), 10.4, 0.3, 3.3, 0, { color: C('#a47650'), walkable: true });
      floor(x - 5.2, x + 5.2, z + 0.4, z + 3.7, 3.1, 'wood', '#c8a47a', 0.3);
      K.stairs(x - 4.45, z - 1.4, 1.5, 3.6, 0, 3.1, Math.PI, { mat: 'wood', color: C('#a47650') });
      for (let i = 0; i <= 8; i++) B.cyl('wood', X(x - 3.6 + i * 1.1), Y(3.1), Z(z + 0.45), 0.04, 0.05, 0.95, 6, { color: C('#7a5238'), collide: false, ao: false });
      B.box('wood', X(x + 0.8), Y(4.0), Z(z + 0.45), 8.8, 0.1, 0.12, 0, { color: C('#7a5238'), collide: false, ao: false });
      K.collision.addBox(X(x + 0.8), Z(z + 0.45), 4.4, 0.08, Y(3.1), Y(4.1), 0, { walkable: false });
      for (let i = 0; i < 4; i++) B.box('wood', X(x - 3.4 + i * 2.8), Y(0), Z(z + 0.45), 0.2, 2.8, 0.2, 0, { color: C('#7a5238') });
      // hearth
      const hx = x + h.hearth * 4.9;
      PR.fireplace(B, X(hx), Y(0), Z(z - 1.6), h.hearth > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2, lamps, fires.small, { hood: 1.3, decor: true });
      light(hx - h.hearth * 1, 1.2, z - 1.6, 0xff9a4a, 7, 8, { flicker: 0.12 });
      light(x, 4.8, z + 2, 0xffc880, 3, 6);
      // table & chairs
      const tx = x + (h.hearth > 0 ? 1.2 : -0.6);
      PR.table(B, X(tx), Y(0), Z(z - 1.7), 0, 1.6, 1.0, true);
      seat(PR.chair(B, X(tx - 0.4), Y(0), Z(z - 2.55), 0, {}));
      seat(PR.chair(B, X(tx + 0.4), Y(0), Z(z - 0.85), Math.PI, {}));
      PR.wardrobe(B, X(x + (h.hearth > 0 ? -2.3 : 2.9)), Y(0), Z(z + 3.35), Math.PI, 1.4, 2.2, '#9a6a44');
      box(h.id + '_ward', 'Шкаф', x + (h.hearth > 0 ? -2.3 : 2.9), 1.0, z + 2.9, [['bread', 1, 0.6], ['gold', [3, 12]], ['apple', 1, 0.5]], { owner: h.id, respawn: 2400 });
      PR.barrel(B, X(x + (h.hearth > 0 ? -1 : 0.8)), Y(0), Z(z + 3.2), 0.85);
      PR.rug(B, X(tx), Y(0), Z(z - 1.7), 0, 2.8, 2.2, ['#e89ac0', '#9fb8e8', '#c7a6f0', '#f2d98a'][list.indexOf(h)], '#fff0c8');
      // loft beds
      PR.bed(B, X(x + 2.5), Y(3.1), Z(z + 2.4), Math.PI / 2, { w: 1.4, len: 2.1, blanket: h.blanket });
      bed(x + 2.5, 3.1, z + 2.4, { owner: h.who });
      if (h.kind === 'family') PR.bed(B, X(x - 1), Y(3.1), Z(z + 2.6), Math.PI / 2, { w: 0.9, len: 1.6, blanket: '#fff0f6' });
      // per-family details
      if (h.kind === 'family') {
        book('b_nelly', 'nelly', tx + 0.3, 0.93, z - 1.9, 0.5, { model: 'note' });
        B.add('fabric', new THREE.CylinderGeometry(1, 1, 1, 14), X(x - 2), Y(0.08), Z(z - 3), 0, 0, 0, 0.45, 0.16, 0.45, { color: C('#f7a8c8'), ao: false }); // cat bed
        for (let i = 0; i < 4; i++) B.box('plain', X(x - 1.2 + i * 0.25), Y(0.02), Z(z - 3.1 + (i % 2) * 0.2), 0.16, 0.16, 0.16, i * 0.4, { color: C(['#ff9ecf', '#9fd8ff', '#ffe08a', '#b8ffb0'][i]), collide: false, ao: false });
        spawn.houses.anna = new THREE.Vector3(X(x + 1.5), Y(0), Z(z - 3));
      } else if (h.kind === 'soldier') {
        PR.armorStand(B, X(x + 4.5), Y(0), Z(z - 3.1), -Math.PI / 2 - 0.5, '#c9d0dc', '#8a6a8a');
        PR.shield(B, X(x + 5.15), Y(1.8), Z(z + 1.6), -Math.PI / 2, '#8a6a8a');
        book('b_oldsoldier', 'oldsoldier', tx + 0.3, 0.93, z - 1.9, 0.2, { model: 'book', color: '#5a4a3a' });
        spawn.houses.tobiasSeat = seat(PR.chair(B, X(x - 2.8), Y(0), Z(z - 0.9), Math.PI / 2 + 0.6, { cushion: '#9fb8e8' }));
      } else if (h.kind === 'weaver') {
        // loom
        for (const sd of [-1, 1]) B.box('wood', X(x - 3), Y(0), Z(z - 2.4 + sd * 0.8), 0.12, 1.7, 0.12, 0, { color: C('#7a5238') });
        B.box('wood', X(x - 3), Y(1.6), Z(z - 2.4), 0.12, 0.12, 1.8, 0, { color: C('#7a5238'), collide: false });
        B.box('wood', X(x - 3), Y(0.7), Z(z - 2.4), 0.8, 0.08, 1.8, 0, { color: C('#7a5238') });
        for (let i = 0; i < 12; i++) B.box('fabric', X(x - 3), Y(0.75), Z(z - 3.1 + i * 0.13), 0.02, 0.85, 0.05, 0, { color: C(['#f7a8c8', '#c7a6f0', '#9fd8ff'][i % 3]), collide: false, ao: false });
        for (let i = 0; i < 4; i++) B.add('fabric', new THREE.CylinderGeometry(1, 1, 1, 12), X(x + 4.2), Y(0.2 + i * 0.36), Z(z + 3.2), 0, 0, Math.PI / 2, 0.18, 1.2, 0.18, { color: C(['#f7a8c8', '#c7a6f0', '#9fd8ff', '#ffe08a'][i]), ao: false });
        spawn.houses.liza = new THREE.Vector3(X(x - 2.2), Y(0), Z(z - 2.4));
      } else if (h.kind === 'baker') {
        // bread oven
        B.add('stone', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), X(x + 3.8), Y(0.9), Z(z + 2.7), 0, 0, 0, 1.2, 1.1, 1.0, { color: C('#d8c8b8') });
        B.box('stone', X(x + 3.8), Y(0), Z(z + 2.7), 2.4, 0.9, 2.0, 0, { color: C('#cdbdad') });
        B.box('fire', X(x + 3.8), Y(0.95), Z(z + 1.72), 0.6, 0.35, 0.05, 0, { collide: false, color: C('#ff9a40') });
        light(x + 3.8, 1.4, z + 1.2, 0xff8a3a, 6, 7, { flicker: 0.12 });
        PR.bottleShelf(B, X(x - 0.2), Y(0), Z(z + 3.4), Math.PI / 2, 2.6, false);
        pick('ho_bread1', 'bread', tx - 0.4, 0.93, z - 1.5, { owner: 'Отто' });
        pick('ho_bread2', 'bread', x - 0.5, 1.17, z + 3.3, { owner: 'Отто' });
        pick('ho_roll', 'sweet_roll', tx + 0.4, 0.93, z - 1.9, { owner: 'Отто' });
        for (let i = 0; i < 3; i++) PR.sack(B, X(x - 4.6 + i * 0.5), Y(0), Z(z + 3.1), 0.9);
        spawn.houses.otto = new THREE.Vector3(X(x + 2.4), Y(0), Z(z + 1));
      }
    }
  }

  // doors for the older buildings (tavern, alchemist, barracks, chapel)
  function otherDoors() {
    door(-48, 0, 30, 0, 2.6, 3.4, { id: 'tavern', name: '«Золотой Грифон»', color: '#9a6a44' });
    door(-51, 0, 6, 0, 2.4, 3.2, { id: 'alchemist', name: 'Лавка алхимика', color: '#8a6a9a' });
    door(49, 0, 4, 0, 2.6, 3.6, { id: 'barracks', name: 'Казарма', color: '#6f5a4a' });
    door(-31, K.TH, -13, Math.PI / 2, 2.8, 4.2, { id: 'chapel', name: 'Часовня', color: '#e8dcc8' });
  }
}
