-- hoa-sweep: read and drive the embark map viewport from DFHack.
--   hoa-sweep info          -> one line: SCREEN=<type> [WORLD=w,h CENT=x,y ZOOM=0/1]
--   hoa-sweep goto X Y      -> set the embark map centre to world tile X,Y
local args = {...}
local cmd = args[1] or 'info'

local function embark()
  return dfhack.gui.getViewscreenByType(df.viewscreen_choose_start_sitest, 0)
end

if cmd == 'info' then
  local scr = dfhack.gui.getCurViewscreen()
  local name = tostring(df.viewscreen.get_vtable_name and '' or '')
  name = getmetatable(scr) and getmetatable(scr).__index and tostring(scr._type) or tostring(scr)
  local e = embark()
  if not e then
    print('SCREEN=' .. tostring(scr._type))
    return
  end
  local wd = df.global.world.world_data
  print(string.format('SCREEN=embark WORLD=%d,%d CENT=%d,%d ZOOM=%d',
    wd.world_width, wd.world_height, e.region_cent_x, e.region_cent_y,
    e.zoomed_in and 1 or 0))
  return
end

if cmd == 'goto' then
  local e = embark() or qerror('not on the embark map')
  local x, y = tonumber(args[2]), tonumber(args[3])
  if not x or not y then qerror('goto X Y') end
  e.region_cent_x = x
  e.region_cent_y = y
  print(string.format('CENT=%d,%d', e.region_cent_x, e.region_cent_y))
  return
end

qerror('unknown command: ' .. cmd)
