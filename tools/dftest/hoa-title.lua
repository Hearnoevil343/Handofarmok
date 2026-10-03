-- hoa-title: inspect and drive the DF title screen non-interactively.
--   hoa-title dump
--   hoa-title menu <idx>        select menu line idx, then SELECT
--   hoa-title region <folder>   select the world whose folder is <folder>, then SELECT
--   hoa-title gametype <idx>    select gametype idx, then SELECT
--   hoa-title key <KEY_NAME>
local gui = require 'gui'
local args = {...}
local t = dfhack.gui.getViewscreenByType(df.viewscreen_titlest, 0)
if not t then
  print('SCREEN=' .. tostring(dfhack.gui.getCurViewscreen()._type))
  return
end
local cmd = args[1] or 'dump'

if cmd == 'dump' then
  print(string.format('mode=%s selected=%d selected_r=%d', tostring(t.mode), t.selected, t.selected_r))
  for i, v in ipairs(t.menu_line_id) do
    print(string.format('menu %d %s', i, tostring(df.main_choice_type[v])))
  end
  for i, v in ipairs(t.gametype) do
    print(string.format('gametype %d %s %s', i, tostring(df.game_type[v]),
      t.gametype_str[i] and tostring(t.gametype_str[i].value) or ''))
  end
  for i, r in ipairs(t.region_choice) do
    print(string.format('region %d %s | %s', i, r.filename_noext, r.display_name))
  end
  for i, s in ipairs(t.savegame_header_world) do
    print(string.format('worldsave %d %s | %s', i, s.filename_noext, s.world_name))
  end
  for i, s in ipairs(t.savegame_header_game) do
    print(string.format('gamesave %d %s | %s', i, s.filename_noext, s.fort_name))
  end
  return
end

if cmd == 'menu' then
  t.selected = tonumber(args[2])
  gui.simulateInput(t, 'SELECT')
  print('ok')
  return
end

if cmd == 'gametype' then
  t.selected = tonumber(args[2])
  gui.simulateInput(t, 'SELECT')
  print('ok')
  return
end

if cmd == 'region' then
  for i, r in ipairs(t.region_choice) do
    if r.filename_noext == args[2] then
      t.selected = i
      t.selected_r = i
      gui.simulateInput(t, 'SELECT')
      print('ok idx=' .. i)
      return
    end
  end
  qerror('no region ' .. tostring(args[2]))
end

if cmd == 'key' then
  gui.simulateInput(t, args[2])
  print('ok')
  return
end
qerror('unknown ' .. cmd)
