// Convenience aliases over the generated OpenAPI component schemas, so feature
// code imports `Room` instead of `components['schemas']['RoomRead']`.
import type { components } from './schema'

type Schemas = components['schemas']

export type Hotel = Schemas['HotelRead']
export type HotelUpdate = Schemas['HotelUpdate']

export type Room = Schemas['RoomRead']
export type RoomCreate = Schemas['RoomCreate']
export type RoomUpdate = Schemas['RoomUpdate']
export type RoomStatus = Schemas['RoomStatus']

export type Staff = Schemas['UserRead']
export type StaffUpdate = Schemas['UserUpdate']
export type UserRole = Schemas['UserRole']

// UI preferences (persisted per-user). The backend inlines these enums on
// UserRead rather than emitting named component schemas, so derive them from the
// field types (keeps `pnpm gen:api` output stable).
export type Theme = NonNullable<Schemas['UserRead']['theme']>
export type Language = NonNullable<Schemas['UserRead']['preferred_language']>

// Access requests (manager → admin approval queue).
export type AccessRequest = Schemas['AccessRequestRead']
export type AccessRequestCreate = Schemas['AccessRequestCreate']
export type RequestResource = Schemas['RequestResource']
export type RequestKind = Schemas['RequestKind']
export type RequestStatus = Schemas['RequestStatus']
export type StaffAddPayload = Schemas['StaffAddPayload']
export type RoomAddPayload = Schemas['RoomAddPayload']

export type WorkloadMoveResponse = Schemas['WorkloadMoveResponse']

// Interactive floor map. HotelMap is the whole-hotel payload; a FloorMap entry
// carries that floor's rooms (with their placement) + decorations.
export type HotelMap = Schemas['HotelMapRead']
export type FloorMap = Schemas['FloorMapRead']
export type FloorMapWrite = Schemas['FloorMapWrite']
export type MapRoom = Schemas['MapRoomRead']
export type Placement = Schemas['PlacementRead']
export type PlacementWrite = Schemas['PlacementWrite']
export type Decoration = Schemas['DecorationRead']
export type DecorationWrite = Schemas['DecorationWrite']
export type DecorationKind = Decoration['kind']

// Floor-map geometry: an [x, y] point in feet, and an ordered list of them that
// forms a shape's outline (a rectangle is just four right-angle vertices).
export type Vertex = [number, number]
export type Polygon = Vertex[]
// A room's door: which wall (edge index) and where along it (t, 0..1).
export type DoorRef = Schemas['DoorRef']

export const DECORATION_KINDS: DecorationKind[] = [
  'hall',
  'stairs',
  'elevator',
  'lobby',
  'label',
]

// Vertical-circulation nodes. These stay first-class, independent shapes on the
// map: they never merge into a hall/lobby, so route-mapping can always pinpoint
// where they join the walkable space, and the front desk can spot them by icon.
export const CIRCULATION_KINDS: DecorationKind[] = ['stairs', 'elevator']

export function isCirculationKind(kind: DecorationKind): boolean {
  return kind === 'stairs' || kind === 'elevator'
}

/** Only the open "space" shapes (halls, lobbies) can be unioned together. Labels
 *  carry no footprint, and circulation nodes (stairs/elevators) are kept separate
 *  on purpose — merging them away would lose where they are for route-mapping. */
export function isMergeableKind(kind: DecorationKind): boolean {
  return kind === 'hall' || kind === 'lobby'
}

// Stats dashboard.
export type CleanTimesResponse = Schemas['CleanTimesResponse']
export type EfficiencyResponse = Schemas['EfficiencyResponse']
export type TaskLoadResponse = Schemas['TaskLoadResponse']
export type RoomTypeAvg = Schemas['RoomTypeAvg']
export type HousekeeperRoomTypeAvg = Schemas['HousekeeperRoomTypeAvg']
export type HousekeeperEfficiency = Schemas['HousekeeperEfficiency']
export type HousekeeperLoad = Schemas['HousekeeperLoad']

// Shifts (housekeeper clock-in/out).
export type Shift = Schemas['ShiftRead']
export type CurrentShiftResponse = Schemas['CurrentShiftResponse']

export type Task = Schemas['TaskRead']
export type TaskCreate = Schemas['TaskCreate']
export type TaskUpdate = Schemas['TaskUpdate']
export type TaskStatus = Schemas['TaskStatus']
export type TaskPriority = Schemas['TaskPriority']

// Bulk "dirty room" task import (PMS + CSV).
export type DirtyRoomImportRequest = Schemas['DirtyRoomImportRequest']
export type DirtyRoomImportResponse = Schemas['DirtyRoomImportResponse']
export type ImportAssignment = Schemas['ImportAssignment']
export type ImportSkip = Schemas['ImportSkip']
// One explicit room → housekeeper assignment (floor-map zone flow).
export type RoomAssignment = Schemas['RoomAssignment']

export const ROOM_STATUSES: RoomStatus[] = [
  'clean',
  'dirty',
  'in_progress',
  'out_of_service',
]

export const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'assigned',
  'in_progress',
  'pending_approval',
  'completed',
]

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'urgent']

export const USER_ROLES: UserRole[] = [
  'admin',
  'manager',
  'front_desk',
  'housekeeper',
]
