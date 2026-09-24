# Люменхолд: Сердце Света

A 3D open-world action RPG in a light-fantasy style that runs in the browser: white castles with spires, endless flower meadows, knights in white-gold armour, unicorns. The whole world is procedural: models, textures, music and sound are generated in code. There are no external assets.

## Running it

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build locally
```

Quality presets: `?quality=low|medium|high` in the address bar, or the settings menu.

## Controls

| Key | Action |
|---|---|
| WASD, Shift | Move, sprint |
| LMB / hold LMB | Attack combo / charged heavy attack |
| RMB | Block; at the moment of impact it parries |
| Space / F | Roll / jump |
| V / C | Whirl of Light / Light Bolt spell |
| Q | Lock on to a target |
| E | Talk, open, pick up, read, sit, sleep |
| R, 1–4 | Healing flask, quick items |
| G | Call the unicorn Astra |
| I · J · M · Esc | Equipment · journal · map · pause |

## What's in the game

- **World.** Meadows, the Whispering Forest with light shafts, Mirror Lake with swans and a crystal spire, a river with waterfalls, mountains. Day and night, rain with a rainbow afterwards, petal storms.
- **The castle of Lumenhold.**
  - Lower ward with a market, tavern, alchemist, smithy, barracks and stables.
  - Halls under the terrace: kitchen, wine cellar, dungeons, guard hall, armory, treasury.
  - Three-storey royal wing with a roof garden, plus the throne room with its library gallery and the mage's observatory.
- **Settlements.** Honey Vale with enterable houses, the bandit camp, crystal ruins with a puzzle.
- **Interaction.** Doors and keys, picking up and stealing items (with witnesses and fines), 25 books and notes, sitting, sleeping, renting a room, containers, alchemy and cooking.
- **Characters.** Over 30 named NPCs with branching dialogue and daily routines, knight patrols on horseback, a court strolling in the meadows.
- **Quests.** The main story (Dawn Shards and the Heart of Light) plus 15 side quests. Some have moral choices: the princess's letter, the prisoner.
- **Combat.** Stamina, poise, parry and riposte, backstab, plunging attack, weapon combos, sparring duel with the prince.
- **Enemies.** Wolves, bandits, Twilight knights, forest trolls, venomous spiders, twilight mages, and three bosses with introductions.
- **Progression and trade.** Levelling through "radiance", merchants with limited stock and gold, altars for resting and fast travel.

## Code structure

- `src/engine`: collision, input, audio
- `src/world`: terrain, sky, vegetation, water, castle and its interiors, props, weather
- `src/entities`: characters, horses, animals, enemies, the player
- `src/game`: items, quests, dialogues, books, interactive objects, population
- `src/ui`: HUD and menus

A desktop build (Electron) is planned for later.
