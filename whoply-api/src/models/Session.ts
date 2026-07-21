import mongoose, { Schema, model } from 'mongoose';

const deviceInfoSchema = new Schema(
    {
        deviceName: { type: String, default: 'Unknown device' },
        deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
        browser: { type: String, default: 'Unknown' },
        os: { type: String, default: 'Unknown' },
        ipAddress: { type: String, default: '' },
    },
    { _id: false }
);

const baseSessionSchema = new Schema(
    {
        token: { type: String, required: true, unique: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        deviceInfo: { type: deviceInfoSchema, default: () => ({}) },
        loginAt: { type: Date, default: Date.now, index: true },
        lastActivityAt: { type: Date, default: Date.now, index: true },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            index: { expires: '1' },
        },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true, collection: 'sessions' }
);

baseSessionSchema.pre('save', function () {
    if (this.isNew) this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
});

const Session = mongoose.models.Session || model('Session', baseSessionSchema);

export default Session;
