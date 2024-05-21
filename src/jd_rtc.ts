import { RealTimeClockReg, RealTimeClockRegPack, JDServiceServer, SRV_REAL_TIME_CLOCK} from 'jacdac-ts';

interface TimeReading {
    // year, month, dayOfMonth, dayOfWeek, hour, min, sec: u16 u8 u8 u8 u8 u8 u8
    year: number; // u16
    month: number; // u8
    dayOfMonth: number; // u8
    dayOfWeek: number; // u8
    hour: number; // u8
    min: number; // u8
    sec: number; // u8

}

class RealtimeService extends JDServiceServer {
    localTime: any;
    private time: TimeReading;

    constructor() {
        super(SRV_REAL_TIME_CLOCK);
        const time = new Date();
        this.time = {
            year: time.getFullYear(),
            month: time.getMonth(),
            dayOfMonth: time.getDate(),
            dayOfWeek: time.getDay(),
            hour: time.getHours(),
            min: time.getMinutes(),
            sec: time.getSeconds()
        }
        const {year, month, dayOfMonth, dayOfWeek, hour, min, sec} = this.time;
        this.localTime = this.addRegister(RealTimeClockReg.LocalTime, [year, month, dayOfMonth, dayOfWeek, hour, min, sec]);
        this.localTime.on(RealTimeClockRegPack.LocalTime, () => {
            const time = new Date();
            this.time = {
                year: time.getFullYear(),
                month: time.getMonth(),
                dayOfMonth: time.getDate(),
                dayOfWeek: time.getDay(),
                hour: time.getHours(),
                min: time.getMinutes(),
                sec: time.getSeconds()
            }
            const {year, month, dayOfMonth, dayOfWeek, hour, min, sec} = this.time;
            this.localTime.setValues([year, month, dayOfMonth, dayOfWeek, hour, min, sec]);
        });
    }
}

export default RealtimeService;
