import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { shopkeeperDashboard } from '../../controllers/shopkeeper/dashboard.controller.js';
import {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../../controllers/shopkeeper/product.controller.js';
import { createSale, listInvoices, getInvoice } from '../../controllers/shopkeeper/billing.controller.js';
import {
    listCustomers,
    createCustomer,
    getCustomerLedger,
    recordRepayment,
} from '../../controllers/shopkeeper/customer.controller.js';
import {
    listSuppliers,
    createSupplier,
    listPurchases,
    createPurchase,
    receivePurchase,
} from '../../controllers/shopkeeper/supplier.controller.js';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../../controllers/shopkeeper/expense.controller.js';
import { salesReport, productReport, profitReport, summaryReport, exportInvoicesCsv } from '../../controllers/shopkeeper/report.controller.js';
import { aiReorder, listNotifications, markAllRead } from '../../controllers/shopkeeper/insights.controller.js';

const router = Router();

// All shopkeeper routes require an authenticated retail-side user
router.use(authenticate, requireRole('owner', 'manager', 'cashier'));

router.get('/dashboard', shopkeeperDashboard);

// Products & categories
router.get('/products', listProducts);
router.post('/products', createProduct);
router.get('/products/:id', getProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/adjust-stock', adjustStock);
router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Billing (POS)
router.post('/billing', createSale);
router.get('/billing', listInvoices);
router.get('/billing/:id', getInvoice);

// Customers & udhar
router.get('/customers', listCustomers);
router.post('/customers', createCustomer);
router.get('/customers/:id/ledger', getCustomerLedger);
router.post('/customers/:id/repayment', recordRepayment);

// Suppliers & purchases
router.get('/suppliers', listSuppliers);
router.post('/suppliers', createSupplier);
router.get('/purchases', listPurchases);
router.post('/purchases', createPurchase);
router.post('/purchases/:id/receive', receivePurchase);

// Expenses
router.get('/expenses', listExpenses);
router.post('/expenses', createExpense);
router.patch('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

// Reports
router.get('/reports/sales', salesReport);
router.get('/reports/products', productReport);
router.get('/reports/profit', profitReport);
router.get('/reports/summary', summaryReport);
router.get('/reports/export', exportInvoicesCsv);

// AI insights + notifications
router.get('/ai/reorder', aiReorder);
router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markAllRead);

export default router;
