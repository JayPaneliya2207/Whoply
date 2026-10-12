/**
 * Announcement — a popup the platform admin shows inside the app: an offer
 * poster, a news headline, a notice. It appears when the app opens, can be
 * closed, and is live only while it is switched on and today is inside its
 * dates (India time). Platform-wide, so it carries no businessId.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IAnnouncement {
    title: string; // the headline
    body?: string;
    image?: string; // the poster: a data URL (the admin panel shrinks it first) or an https link
    hasImage: boolean; // kept in step with `image`, so lists can leave the picture out
    linkUrl?: string; // optional button, https only
    linkLabel?: string;
    audience: 'all' | 'retail' | 'wholesale';
    staffToo: boolean; // false = owners only (an offer on the plan is not the cashier's business)
    isActive: boolean; // the on / off switch
    startsAt?: Date; // first moment it shows (start of that India day); unset = from now
    endsAt?: Date; // first moment it no longer shows (end of the last India day); unset = until switched off
    createdBy?: Types.ObjectId;
}
export interface IAnnouncementDocument extends IAnnouncement, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncementDocument>(
    {
        title: { type: String, required: true, trim: true, maxlength: 120 },
        body: { type: String, trim: true, maxlength: 1000 },
        image: { type: String },
        hasImage: { type: Boolean, default: false },
        linkUrl: { type: String, trim: true, maxlength: 300 },
        linkLabel: { type: String, trim: true, maxlength: 30 },
        audience: { type: String, enum: ['all', 'retail', 'wholesale'], default: 'all' },
        staffToo: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        startsAt: Date,
        endsAt: Date,
        createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    },
    { timestamps: true, collection: 'announcements' }
);
announcementSchema.index({ isActive: 1, endsAt: 1 });

export type AnnouncementStatus = 'off' | 'scheduled' | 'live' | 'ended';

/** Where an announcement stands right now. */
export const announcementStatus = (a: Pick<IAnnouncement, 'isActive' | 'startsAt' | 'endsAt'>, now: Date = new Date()): AnnouncementStatus =>
    !a.isActive ? 'off' : a.endsAt && a.endsAt <= now ? 'ended' : a.startsAt && a.startsAt > now ? 'scheduled' : 'live';

/** Mongo filter for "live right now" (the same rule as announcementStatus === 'live'). */
export const liveNow = (now: Date = new Date()) => ({
    isActive: true,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }],
});

const Announcement: Model<IAnnouncementDocument> = mongoose.models.Announcement || mongoose.model<IAnnouncementDocument>('Announcement', announcementSchema);
export default Announcement;
