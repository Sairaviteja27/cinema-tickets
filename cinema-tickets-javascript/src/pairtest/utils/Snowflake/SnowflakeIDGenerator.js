
// Simulating Twitter (now X) Snowflake approach for generating Transaction ID
export default class SnowflakeIDGenerator {
    constructor(machineId, customEpoch = 1288834974657) {  // using twitter snowflake default epoch
        this.machineId = machineId & 0x3FF; //Ensuring 10-bit machine ID
        this.customEpoch = customEpoch;
        this.sequence = 0;
        this.lastTimestamp = -1;
    }

    _currentTimestamp() {
        return Date.now(); // Get current timestamp in milliseconds
    }

    generateId() {
        let timestamp = this._currentTimestamp();

        if (timestamp === this.lastTimestamp) {
            this.sequence = (this.sequence + 1) & 0xFFF;
            if (this.sequence === 0) {
                while (timestamp <= this.lastTimestamp) {
                    timestamp = this._currentTimestamp();
                }
            }
        } else {
            this.sequence = 0;
        }

        this.lastTimestamp = timestamp;

        return ((BigInt(timestamp - this.customEpoch) << 22n) |
            (BigInt(this.machineId) << 12n) |
            BigInt(this.sequence)).toString();
    }
}