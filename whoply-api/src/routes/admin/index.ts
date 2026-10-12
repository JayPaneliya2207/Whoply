import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { requireAdminPerm as ap } from '../../utils/adminAccess.js';
import { auditAdminWrites } from '../../models/AdminAudit.js';
import {
    listBusinesses,
    createBusiness,
    businessDetail,
    updateBusiness,
    deleteBusiness,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
} from '../../controllers/admin/admin.controller.js';
import { platformStats } from '../../controllers/admin/stats.controller.js';
import { listUsers, createUser, updateUser, deleteUser } from '../../controllers/admin/users.controller.js';
import { supportSummary, listThreads, getThread, reply, startThread, setThreadStatus } from '../../controllers/admin/support.controller.js';
import { getSettings, updateSettings, listBills, getBill, createBillFor, runBills, remind, updateBill } from '../../controllers/admin/billing.controller.js';
import { getWhatsapp, updateWhatsapp, testWhatsapp } from '../../controllers/admin/whatsapp.controller.js';
import { accessInfo, listAdmins, createAdmin, updateAdmin, deleteAdmin, resetAdminTwoStep, listAudit } from '../../controllers/admin/access.controller.js';
import { listInquiries, inquirySummary, updateInquiry, deleteInquiry } from '../../controllers/admin/inquiries.controller.js';
import { listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../controllers/admin/announcements.controller.js';

/**
 * Every route needs an admin login AND the permission named beside it
 * (utils/adminAccess.ts: super / support / billing / viewer). Successful
 * writes are recorded in the activity log.
 */
const router = Router();
router.use(authenticate, requireRole('admin'), auditAdminWrites);

// What this admin may do — drives the panel's menu
router.get('/access', accessInfo);

router.get('/stats', ap('stats.view'), platformStats);

// Businesses
router.get('/businesses', ap('businesses.view'), listBusinesses);
router.post('/businesses', ap('businesses.manage'), createBusiness);
router.get('/businesses/:id', ap('businesses.view'), businessDetail);
router.patch('/businesses/:id', ap('businesses.manage'), updateBusiness);
router.delete('/businesses/:id', ap('businesses.manage'), deleteBusiness);

// Users (logins across every business)
router.get('/users', ap('users.view'), listUsers);
router.post('/users', ap('users.manage'), createUser);
router.patch('/users/:id', ap('users.manage'), updateUser);
router.delete('/users/:id', ap('users.manage'), deleteUser);

// Plans / subscriptions
router.get('/plans', ap('plans.view'), listPlans);
router.post('/plans', ap('plans.manage'), createPlan);
router.patch('/plans/:id', ap('plans.manage'), updatePlan);
router.delete('/plans/:id', ap('plans.manage'), deletePlan);

// Subscription bills + the settings behind them (the Billing page prints with the company details)
router.get('/settings', ap('settings.manage', 'billing.view'), getSettings);
router.put('/settings', ap('settings.manage'), updateSettings);
// The WhatsApp gateway that sends sign-in codes — its token is write-only, so it has its own routes
router.get('/whatsapp', ap('settings.manage'), getWhatsapp);
router.put('/whatsapp', ap('settings.manage'), updateWhatsapp);
router.post('/whatsapp/test', ap('settings.manage'), testWhatsapp);
router.get('/bills', ap('billing.view'), listBills);
router.post('/bills', ap('billing.manage'), createBillFor);
router.post('/bills/run', ap('billing.manage'), runBills);
router.get('/bills/:id', ap('billing.view'), getBill);
router.post('/bills/:id/remind', ap('billing.manage'), remind);
router.patch('/bills/:id', ap('billing.manage'), updateBill);

// Support chat with businesses
router.get('/support/summary', ap('support.chat'), supportSummary);
router.get('/support/threads', ap('support.chat'), listThreads);
router.post('/support/threads', ap('support.chat'), startThread);
router.get('/support/threads/:id', ap('support.chat'), getThread);
router.post('/support/threads/:id/messages', ap('support.chat'), reply);
router.patch('/support/threads/:id', ap('support.chat'), setThreadStatus);

// Contact inquiries from the marketing site
router.get('/inquiries', ap('inquiries.view'), listInquiries);
router.get('/inquiries/summary', ap('inquiries.view'), inquirySummary);
router.patch('/inquiries/:id', ap('inquiries.manage'), updateInquiry);
router.delete('/inquiries/:id', ap('inquiries.manage'), deleteInquiry);

// Popups shown inside the app: offers, news, notices
router.get('/announcements', ap('announcements.manage'), listAnnouncements);
router.post('/announcements', ap('announcements.manage'), createAnnouncement);
router.get('/announcements/:id', ap('announcements.manage'), getAnnouncement);
router.patch('/announcements/:id', ap('announcements.manage'), updateAnnouncement);
router.delete('/announcements/:id', ap('announcements.manage'), deleteAnnouncement);

// Access control: admin logins and the activity log
router.get('/admins', ap('admins.manage'), listAdmins);
router.post('/admins', ap('admins.manage'), createAdmin);
router.patch('/admins/:id', ap('admins.manage'), updateAdmin);
router.delete('/admins/:id', ap('admins.manage'), deleteAdmin);
router.delete('/admins/:id/two-step', ap('admins.manage'), resetAdminTwoStep);
router.get('/audit', ap('admins.manage'), listAudit);

export default router;
