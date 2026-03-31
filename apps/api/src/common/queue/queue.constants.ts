export const SCHEDULE_TICK_QUEUE = 'schedule-tick';
export const SCHEDULE_TICK_JOB = 'schedule-tick';
export const SCHEDULE_TICK_JOB_ID = 'schedule-tick:repeat';
export const SCHEDULE_TICK_INSTANCE = `schedule-tick:${process.pid}`;

let lastScheduleTickAt: Date | null = null;
let latestConsumerInstanceId: string | null = null;

export function markScheduleTickHeartbeat(at = new Date(), instanceId = SCHEDULE_TICK_INSTANCE) {
  lastScheduleTickAt = at;
  latestConsumerInstanceId = instanceId;
}

export function readLatestScheduleTickConsumerInstanceId() {
  return latestConsumerInstanceId;
}

export function readScheduleTickStatus(now = new Date()) {
  if (process.env.ENABLE_SCHEDULE_TICK !== 'true') {
    return 'idle';
  }

  if (lastScheduleTickAt === null) {
    return 'idle';
  }

  const tickEveryMs = Number(process.env.SCHEDULE_TICK_EVERY_MS ?? '30000');
  return now.getTime() - lastScheduleTickAt.getTime() <= tickEveryMs * 2 ? 'running' : 'idle';
}
