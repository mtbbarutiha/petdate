import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppGuards } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { LegacyAdoptionHashRedirect } from './components/LegacyAdoptionHashRedirect';
import { PersistTagAssistantParams } from './components/PersistTagAssistantParams';
import { RouteSeo } from './components/RouteSeo';
import { ShopCartProvider } from './hooks/useShopCart';
import { AppToastProvider } from './hooks/useAppToast';
import { LandingMobileDock } from './components/LandingMobileDock';
import { ScrollToTop } from './components/ScrollToTop';
import { trackPageview } from './lib/siteAnalytics';
import { withTagAssistantParams } from './lib/tagAssistantParams';
import { WelcomePage } from './pages/WelcomePage';
import { VetConsultRoute } from './pages/VetConsultRoute';

function SiteAnalyticsListener() {
  const location = useLocation();
  useEffect(() => {
    // Include search so UTM landing + SPA query changes still push GTM page_view.
    trackPageview(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
  return null;
}

/** Alias / catch-all redirects must keep Tag Assistant debug query params. */
function RedirectWithTagAssistant({ to }: { to: string }) {
  return <Navigate to={withTagAssistantParams(to)} replace />;
}

import { LoginPage } from './pages/auth/LoginPage';

/* Heavy / rarely-first routes — keep welcome + login in the main chunk. */
const OtpPage = lazy(() => import('./pages/auth/OtpPage').then((m) => ({ default: m.OtpPage })));
const TelegramLinkPage = lazy(() =>
  import('./pages/auth/TelegramLinkPage').then((m) => ({ default: m.TelegramLinkPage })),
);
const FaqPage = lazy(() => import('./pages/FaqPage').then((m) => ({ default: m.FaqPage })));
const MagazinePage = lazy(() =>
  import('./pages/MagazinePage').then((m) => ({ default: m.MagazinePage })),
);
const MagazineArticlePage = lazy(() =>
  import('./pages/MagazineArticlePage').then((m) => ({ default: m.MagazineArticlePage })),
);
const AdoptionListPage = lazy(() =>
  import('./pages/AdoptionListPage').then((m) => ({ default: m.AdoptionListPage })),
);
const AdoptionDetailPage = lazy(() =>
  import('./pages/AdoptionDetailPage').then((m) => ({ default: m.AdoptionDetailPage })),
);
const ShopHomePage = lazy(() =>
  import('./pages/shop/ShopHomePage').then((m) => ({ default: m.ShopHomePage })),
);
const ShopCategoryPage = lazy(() =>
  import('./pages/shop/ShopCategoryPage').then((m) => ({ default: m.ShopCategoryPage })),
);
const ShopProductPage = lazy(() =>
  import('./pages/shop/ShopProductPage').then((m) => ({ default: m.ShopProductPage })),
);
const ShopCartPage = lazy(() =>
  import('./pages/shop/ShopCartPage').then((m) => ({ default: m.ShopCartPage })),
);
const ShopStarsPayPage = lazy(() =>
  import('./pages/shop/ShopStarsPayPage').then((m) => ({ default: m.ShopStarsPayPage })),
);
const ShopCardPayPage = lazy(() =>
  import('./pages/shop/ShopCardPayPage').then((m) => ({ default: m.ShopCardPayPage })),
);
const ShopOrdersPage = lazy(() =>
  import('./pages/shop/ShopOrdersPage').then((m) => ({ default: m.ShopOrdersPage })),
);
const RoleSelectPage = lazy(() =>
  import('./pages/onboarding/RoleSelectPage').then((m) => ({ default: m.RoleSelectPage })),
);
const ProfileWizardPage = lazy(() =>
  import('./pages/onboarding/ProfileWizardPage').then((m) => ({ default: m.ProfileWizardPage })),
);
const RoleWizardPage = lazy(() =>
  import('./pages/onboarding/RoleWizardPage').then((m) => ({ default: m.RoleWizardPage })),
);
const PetOnboardingPage = lazy(() =>
  import('./pages/onboarding/PetOnboardingPage').then((m) => ({ default: m.PetOnboardingPage })),
);
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const PetDetailPage = lazy(() =>
  import('./pages/PetDetailPage').then((m) => ({ default: m.PetDetailPage })),
);
const PublicPetPage = lazy(() =>
  import('./pages/PublicPetPage').then((m) => ({ default: m.PublicPetPage })),
);
const PetEditPage = lazy(() =>
  import('./pages/PetEditPage').then((m) => ({ default: m.PetEditPage })),
);
const MyPetsPage = lazy(() => import('./pages/MyPetsPage').then((m) => ({ default: m.MyPetsPage })));
const AddPetPage = lazy(() => import('./pages/AddPetPage').then((m) => ({ default: m.AddPetPage })));
const MatchesPage = lazy(() =>
  import('./pages/MatchesPage').then((m) => ({ default: m.MatchesPage })),
);
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const WalletPage = lazy(() => import('./pages/WalletPage').then((m) => ({ default: m.WalletPage })));
const SupportChatPage = lazy(() =>
  import('./pages/SupportChatPage').then((m) => ({ default: m.SupportChatPage }))
);
const EarningsPage = lazy(() =>
  import('./pages/EarningsPage').then((m) => ({ default: m.EarningsPage })),
);
const TrainerConsultPage = lazy(() =>
  import('./pages/ServiceConsultPage').then((m) => ({ default: m.TrainerConsultPage })),
);
const TeamChatStartPage = lazy(() =>
  import('./pages/TeamChatStartPage').then((m) => ({ default: m.TeamChatStartPage })),
);
const VetChatPage = lazy(() =>
  import('./pages/VetChatPage').then((m) => ({ default: m.VetChatPage })),
);

const AdminGuard = lazy(() =>
  import('./admin/AdminGuard').then((m) => ({ default: m.AdminGuard })),
);
const AdminLayout = lazy(() =>
  import('./admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminLoginPage = lazy(() =>
  import('./admin/pages/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import('./admin/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminPetsPage = lazy(() =>
  import('./admin/pages/AdminPetsPage').then((m) => ({ default: m.AdminPetsPage })),
);
const AdminPetFormPage = lazy(() =>
  import('./admin/pages/AdminPetFormPage').then((m) => ({ default: m.AdminPetFormPage })),
);
const AdminVerificationPage = lazy(() =>
  import('./admin/pages/AdminVerificationPage').then((m) => ({ default: m.AdminVerificationPage })),
);
const AdminMarketplaceModerationPage = lazy(() =>
  import('./admin/pages/AdminMarketplaceModerationPage').then((m) => ({
    default: m.AdminMarketplaceModerationPage,
  })),
);
const AdminLogsPage = lazy(() =>
  import('./admin/pages/AdminLogsPage').then((m) => ({ default: m.AdminLogsPage })),
);
const AdminMailPage = lazy(() =>
  import('./admin/pages/AdminMailPage').then((m) => ({ default: m.AdminMailPage })),
);
const AdminMonitoringPage = lazy(() =>
  import('./admin/pages/AdminMonitoringPage').then((m) => ({ default: m.AdminMonitoringPage })),
);
const AdminSiteReportsPage = lazy(() =>
  import('./admin/pages/AdminSiteReportsPage').then((m) => ({ default: m.AdminSiteReportsPage })),
);
const AdminTagManagerPage = lazy(() =>
  import('./admin/pages/AdminTagManagerPage').then((m) => ({ default: m.AdminTagManagerPage })),
);
const AdminConsultsPage = lazy(() =>
  import('./admin/pages/AdminConsultsPage').then((m) => ({ default: m.AdminConsultsPage })),
);
const AdminPlaydatesPage = lazy(() =>
  import('./admin/pages/AdminPlaydatesPage').then((m) => ({ default: m.AdminPlaydatesPage })),
);
const AdminShopProductsPage = lazy(() =>
  import('./admin/pages/AdminShopProductsPage').then((m) => ({ default: m.AdminShopProductsPage })),
);
const AdminShopProductFormPage = lazy(() =>
  import('./admin/pages/AdminShopProductFormPage').then((m) => ({
    default: m.AdminShopProductFormPage,
  })),
);
const AdminShopCategoriesPage = lazy(() =>
  import('./admin/pages/AdminShopCategoriesPage').then((m) => ({
    default: m.AdminShopCategoriesPage,
  })),
);
const AdminShopOrdersPage = lazy(() =>
  import('./admin/pages/AdminShopOrdersPage').then((m) => ({ default: m.AdminShopOrdersPage })),
);
const AdminPaymentsPage = lazy(() =>
  import('./admin/pages/AdminPaymentsPage').then((m) => ({ default: m.AdminPaymentsPage })),
);
const AdminContentPage = lazy(() =>
  import('./admin/pages/AdminContentPage').then((m) => ({ default: m.AdminContentPage })),
);
const AdminMagazinePage = lazy(() =>
  import('./admin/pages/AdminMagazinePage').then((m) => ({ default: m.AdminMagazinePage })),
);
const AdminMagazineFormPage = lazy(() =>
  import('./admin/pages/AdminMagazineFormPage').then((m) => ({ default: m.AdminMagazineFormPage })),
);
const AdminSettingsPage = lazy(() =>
  import('./admin/pages/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
);
const AdminFinanceDashboardPage = lazy(() =>
  import('./admin/pages/AdminFinanceDashboardPage').then((m) => ({
    default: m.AdminFinanceDashboardPage,
  })),
);
const AdminFinancePnLPage = lazy(() =>
  import('./admin/pages/AdminFinancePnLPage').then((m) => ({ default: m.AdminFinancePnLPage })),
);
const AdminFinanceSalesPage = lazy(() =>
  import('./admin/pages/AdminFinanceSalesPage').then((m) => ({ default: m.AdminFinanceSalesPage })),
);
const AdminFinanceOrdersPage = lazy(() =>
  import('./admin/pages/AdminFinanceOrdersPage').then((m) => ({
    default: m.AdminFinanceOrdersPage,
  })),
);
const AdminFinanceWalletPage = lazy(() =>
  import('./admin/pages/AdminFinanceWalletPage').then((m) => ({
    default: m.AdminFinanceWalletPage,
  })),
);
const AdminFinanceProductsPage = lazy(() =>
  import('./admin/pages/AdminFinanceProductsPage').then((m) => ({
    default: m.AdminFinanceProductsPage,
  })),
);
const AdminFinanceAccountsPage = lazy(() =>
  import('./admin/pages/finance/AdminFinanceAccountsPage').then((m) => ({
    default: m.AdminFinanceAccountsPage,
  })),
);
const AdminFinanceTransactionsPage = lazy(() =>
  import('./admin/pages/finance/AdminFinanceTransactionsPage').then((m) => ({
    default: m.AdminFinanceTransactionsPage,
  })),
);
const AdminFinanceAllocationPage = lazy(() =>
  import('./admin/pages/finance/AdminFinanceAllocationPage').then((m) => ({
    default: m.AdminFinanceAllocationPage,
  })),
);
const AdminHrEmployeesPage = lazy(() =>
  import('./admin/pages/hr/AdminHrEmployeesPage').then((m) => ({
    default: m.AdminHrEmployeesPage,
  })),
);
const AdminHrEmployeeDetailPage = lazy(() =>
  import('./admin/pages/hr/AdminHrEmployeeDetailPage').then((m) => ({
    default: m.AdminHrEmployeeDetailPage,
  })),
);
const AdminHrContractsPage = lazy(() =>
  import('./admin/pages/hr/AdminHrContractsPage').then((m) => ({
    default: m.AdminHrContractsPage,
  })),
);
const AdminHrAtsPage = lazy(() =>
  import('./admin/pages/hr/AdminHrAtsPage').then((m) => ({ default: m.AdminHrAtsPage })),
);
const AdminHrSettingsPage = lazy(() =>
  import('./admin/pages/hr/AdminHrSettingsPage').then((m) => ({
    default: m.AdminHrSettingsPage,
  })),
);
const AdminHrRbacPage = lazy(() =>
  import('./admin/pages/hr/AdminHrRbacPage').then((m) => ({ default: m.AdminHrRbacPage })),
);
const AdminHrDashboardPage = lazy(() =>
  import('./admin/pages/hr/AdminHrDashboardPage').then((m) => ({ default: m.AdminHrDashboardPage })),
);
const AdminHrRecruitmentDashboardPage = lazy(() =>
  import('./admin/pages/hr/AdminHrRecruitmentDashboardPage').then((m) => ({
    default: m.AdminHrRecruitmentDashboardPage,
  })),
);
const AdminHrOnboardingPage = lazy(() =>
  import('./admin/pages/hr/AdminHrOnboardingPage').then((m) => ({
    default: m.AdminHrOnboardingPage,
  })),
);
const AdminHrRequestsPage = lazy(() =>
  import('./admin/pages/hr/AdminHrRequestsPage').then((m) => ({ default: m.AdminHrRequestsPage })),
);
const AdminHrServicePage = lazy(() =>
  import('./admin/pages/hr/AdminHrServicePage').then((m) => ({ default: m.AdminHrServicePage })),
);
const AdminHrReportsPage = lazy(() =>
  import('./admin/pages/hr/AdminHrReportsPage').then((m) => ({ default: m.AdminHrReportsPage })),
);
const AdminHrCostPage = lazy(() =>
  import('./admin/pages/hr/AdminHrCostPage').then((m) => ({ default: m.AdminHrCostPage })),
);
const AdminHrCompensationPage = lazy(() =>
  import('./admin/pages/hr/AdminHrCompensationPage').then((m) => ({
    default: m.AdminHrCompensationPage,
  })),
);
const AdminHrCareerPage = lazy(() =>
  import('./admin/pages/hr/AdminHrCareerPage').then((m) => ({ default: m.AdminHrCareerPage })),
);
const AdminHrCockpitPage = lazy(() =>
  import('./admin/pages/hr/AdminHrCockpitPage').then((m) => ({ default: m.AdminHrCockpitPage })),
);
const AdminHrArmitaPage = lazy(() =>
  import('./admin/pages/hr/AdminHrArmitaPage').then((m) => ({ default: m.AdminHrArmitaPage })),
);
const SalesGuard = lazy(() => import('./admin/pages/sales/SalesGuard').then((m) => ({ default: m.SalesGuard })));
const AdminSalesDashboardPage = lazy(() => import('./admin/pages/sales/AdminSalesDashboardPage').then((m) => ({ default: m.AdminSalesDashboardPage })));
const AdminSalesLeadsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesLeadsPage })));
const AdminPetPurchaseRequestsPage = lazy(() => import('./admin/pages/sales/AdminPetPurchaseRequestsPage').then((m) => ({ default: m.AdminPetPurchaseRequestsPage })));
const AdminSalesUpgradesPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesUpgradesPage })));
const AdminSalesLeadDetailPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesLeadDetailPage })));
const AdminSalesUpgradeDetailPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesUpgradeDetailPage })));
const AdminSalesPipelinePage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesPipelinePage })));
const AdminSalesDealsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesDealsPage })));
const AdminSalesCustomersPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesCustomersPage })));
const AdminSalesCustomerDetailPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesCustomerDetailPage })));
const AdminSalesProductsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesProductsPage })));
const AdminSalesTicketsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesTicketsPage })));
const AdminSalesCallsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesCallsPage })));
const AdminSalesReportsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesReportsPage })));
const AdminSalesSettingsPage = lazy(() => import('./admin/pages/sales/AdminSalesPages').then((m) => ({ default: m.AdminSalesSettingsPage })));
const AdminCrmDashboardPage = lazy(() => import('./admin/pages/crm/AdminCrmDashboardPage').then((m) => ({ default: m.AdminCrmDashboardPage })));
const AdminCrmInboxPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmInboxPage })));
const AdminCrmCustomersPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmCustomersPage })));
const AdminCrmCustomerDetailPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmCustomerDetailPage })));
const AdminCrmExperiencePage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmExperiencePage })));
const AdminCrmCallsPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmCallsPage })));
const AdminCrmCasesPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmCasesPage })));
const AdminCrmTicketingPage = lazy(() => import('./admin/pages/crm/AdminCrmTicketingPage').then((m) => ({ default: m.AdminCrmTicketingPage })));
const AdminCrmSmsPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmSmsPage })));
const AdminCrmQaPage = lazy(() => import('./admin/pages/crm/AdminCrmPages').then((m) => ({ default: m.AdminCrmQaPage })));
const AdminCrmReportsPage = lazy(() => import('./admin/pages/crm/AdminCrmReportsPage').then((m) => ({ default: m.AdminCrmReportsPage })));
const AdminCrmSettingsPage = lazy(() => import('./admin/pages/crm/AdminCrmSettingsPage'));


function RouteFallback() {
  return <div className="pd-route-fallback" aria-hidden="true" />;
}

export default function App() {
  return (
    <AppGuards>
      <AppToastProvider>
      <ShopCartProvider>
        <ScrollToTop />
        <LegacyAdoptionHashRedirect />
        <PersistTagAssistantParams />
        <SiteAnalyticsListener />
        <RouteSeo />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route index element={<WelcomePage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="magazine" element={<MagazinePage />} />
            <Route path="magazine/:slug" element={<MagazineArticlePage />} />
            <Route path="news" element={<Navigate to="/magazine" replace />} />
            <Route path="adoption" element={<AdoptionListPage />} />
            <Route path="adoption/:slug" element={<AdoptionDetailPage />} />
            <Route path="pet/:slugOrId" element={<PublicPetPage />} />
            <Route path="vet-consult" element={<VetConsultRoute />} />
            <Route path="team-chat/:agentSlug" element={<TeamChatStartPage />} />
            <Route path="shop" element={<ShopHomePage />} />
            <Route path="shop/c/:category" element={<ShopCategoryPage />} />
            <Route path="shop/product/:id" element={<ShopProductPage />} />
            <Route path="shop/cart" element={<ShopCartPage />} />
            <Route path="shop/orders" element={<ShopOrdersPage />} />
            <Route path="shop/stars-pay/:paymentOrderId" element={<ShopStarsPayPage />} />
            <Route path="shop/card-pay/:paymentOrderId" element={<ShopCardPayPage />} />
            <Route path="auth/login" element={<LoginPage />} />
            <Route path="auth/otp" element={<OtpPage />} />
            <Route path="auth/telegram" element={<TelegramLinkPage />} />
            <Route path="onboarding/role" element={<RoleSelectPage />} />
            <Route path="onboarding/profile" element={<ProfileWizardPage />} />
            <Route path="onboarding/wizard/:role" element={<RoleWizardPage />} />
            <Route path="onboarding/pet" element={<PetOnboardingPage />} />

            <Route element={<Layout />}>
              <Route path="home" element={<HomePage />} />
              <Route path="explore" element={<RedirectWithTagAssistant to="/chats" />} />
              <Route path="pets/:id" element={<PetDetailPage />} />
              <Route path="pets/:id/edit" element={<PetEditPage />} />
              <Route path="my-pets" element={<MyPetsPage />} />
              <Route path="add-pet" element={<AddPetPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="chats" element={<ChatPage />} />
              <Route path="chats/:matchId" element={<ChatPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="support" element={<SupportChatPage />} />
              <Route path="wallet/earn" element={<EarningsPage />} />
              <Route path="earn" element={<RedirectWithTagAssistant to="/wallet/earn" />} />
              <Route path="trainer-consult" element={<TrainerConsultPage />} />
              <Route path="sitter-consult" element={<Navigate to="/home" replace />} />
              <Route path="vet-chats" element={<RedirectWithTagAssistant to="/vet-consult" />} />
              <Route path="vet-chats/:consultId" element={<VetChatPage />} />
            </Route>

            <Route path="admin/login" element={<AdminLoginPage />} />
            <Route path="admin" element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="pets" element={<AdminPetsPage />} />
                <Route path="pets/new" element={<AdminPetFormPage />} />
                <Route path="pets/:id/edit" element={<AdminPetFormPage />} />
                <Route path="playdates" element={<AdminPlaydatesPage />} />
                <Route path="matches" element={<Navigate to="/admin/playdates" replace />} />
                <Route path="consults" element={<AdminConsultsPage />} />
                <Route path="verification" element={<AdminVerificationPage />} />
                <Route path="marketplace-moderation" element={<AdminMarketplaceModerationPage />} />
                <Route path="shop/products" element={<AdminShopProductsPage />} />
                <Route path="shop/products/new" element={<AdminShopProductFormPage />} />
                <Route path="shop/products/:id" element={<AdminShopProductFormPage />} />
                <Route path="shop/categories" element={<AdminShopCategoriesPage />} />
                <Route path="shop/orders" element={<AdminShopOrdersPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="finance" element={<AdminFinanceDashboardPage />} />
                <Route path="finance/pnl" element={<AdminFinancePnLPage />} />
                <Route path="finance/sales" element={<AdminFinanceSalesPage />} />
                <Route path="finance/orders" element={<AdminFinanceOrdersPage />} />
                <Route path="finance/wallet" element={<AdminFinanceWalletPage />} />
                <Route path="finance/products" element={<AdminFinanceProductsPage />} />
                <Route path="finance/accounts" element={<AdminFinanceAccountsPage />} />
                <Route path="finance/transactions" element={<AdminFinanceTransactionsPage />} />
                <Route path="finance/allocation" element={<AdminFinanceAllocationPage />} />
                <Route path="content" element={<AdminContentPage />} />
                <Route path="magazine" element={<AdminMagazinePage />} />
                <Route path="magazine/new" element={<AdminMagazineFormPage />} />
                <Route path="magazine/:id" element={<AdminMagazineFormPage />} />
                <Route path="mail" element={<AdminMailPage />} />
                <Route path="logs" element={<AdminLogsPage />} />
                <Route path="monitoring" element={<AdminMonitoringPage />} />
                <Route path="analytics" element={<AdminSiteReportsPage />} />
                <Route path="site-reports" element={<AdminSiteReportsPage />} />
                <Route path="tag-manager" element={<AdminTagManagerPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="hr" element={<AdminHrDashboardPage />} />
                <Route path="hr/recruitment" element={<AdminHrRecruitmentDashboardPage />} />
                <Route path="hr/employees" element={<AdminHrEmployeesPage />} />
                <Route path="hr/employees/:id" element={<AdminHrEmployeeDetailPage />} />
                <Route path="hr/contracts" element={<AdminHrContractsPage />} />
                <Route path="hr/ats" element={<AdminHrAtsPage />} />
                <Route path="hr/onboarding" element={<AdminHrOnboardingPage />} />
                <Route path="hr/requests" element={<AdminHrRequestsPage />} />
                <Route path="hr/service" element={<AdminHrServicePage />} />
                <Route path="hr/reports" element={<AdminHrReportsPage />} />
                <Route path="hr/cost" element={<AdminHrCostPage />} />
                <Route path="hr/compensation" element={<AdminHrCompensationPage />} />
                <Route path="hr/career" element={<AdminHrCareerPage />} />
                <Route path="hr/cockpit" element={<AdminHrCockpitPage />} />
                <Route path="hr/armita" element={<AdminHrArmitaPage />} />
                <Route path="hr/settings" element={<AdminHrSettingsPage />} />
                <Route path="hr/rbac" element={<AdminHrRbacPage />} />
                <Route path="sales" element={<SalesGuard><AdminSalesDashboardPage /></SalesGuard>} />
                <Route path="sales/leads" element={<SalesGuard><AdminSalesLeadsPage /></SalesGuard>} />
                <Route path="sales/leads/:id" element={<SalesGuard><AdminSalesLeadDetailPage /></SalesGuard>} />
                <Route path="sales/pet-purchase-requests" element={<SalesGuard><AdminPetPurchaseRequestsPage /></SalesGuard>} />
                <Route path="sales/upgrades" element={<SalesGuard><AdminSalesUpgradesPage /></SalesGuard>} />
                <Route path="sales/upgrades/:id" element={<SalesGuard><AdminSalesUpgradeDetailPage /></SalesGuard>} />
                <Route path="sales/pipeline" element={<SalesGuard><AdminSalesPipelinePage /></SalesGuard>} />
                <Route path="sales/deals" element={<SalesGuard><AdminSalesDealsPage /></SalesGuard>} />
                <Route path="sales/customers" element={<SalesGuard><AdminSalesCustomersPage /></SalesGuard>} />
                <Route path="sales/customers/:id" element={<SalesGuard><AdminSalesCustomerDetailPage /></SalesGuard>} />
                <Route path="sales/products" element={<SalesGuard><AdminSalesProductsPage /></SalesGuard>} />
                <Route path="sales/tickets" element={<SalesGuard><AdminSalesTicketsPage /></SalesGuard>} />
                <Route path="sales/calls" element={<SalesGuard><AdminSalesCallsPage /></SalesGuard>} />
                <Route path="sales/reports" element={<SalesGuard><AdminSalesReportsPage /></SalesGuard>} />
                <Route path="sales/settings" element={<SalesGuard><AdminSalesSettingsPage /></SalesGuard>} />
                <Route path="crm" element={<AdminCrmDashboardPage />} />
                <Route path="crm/workspace" element={<AdminCrmDashboardPage />} />
                <Route path="customers" element={<Navigate to="/admin/crm" replace />} />
                <Route path="crm/inbox" element={<AdminCrmInboxPage />} />
                <Route path="crm/customers" element={<AdminCrmCustomersPage />} />
                <Route path="crm/customers/:id" element={<AdminCrmCustomerDetailPage />} />
                <Route path="crm/experience" element={<AdminCrmExperiencePage />} />
                <Route path="crm/calls" element={<AdminCrmCallsPage />} />
                <Route path="crm/ticketing" element={<AdminCrmTicketingPage />} />
                <Route path="crm/cases" element={<AdminCrmCasesPage />} />
                <Route path="crm/tickets" element={<Navigate to="/admin/crm/ticketing" replace />} />
                <Route path="crm/sms" element={<AdminCrmSmsPage />} />
                <Route path="crm/qa" element={<AdminCrmQaPage />} />
                <Route path="crm/reports" element={<AdminCrmReportsPage />} />
                <Route path="crm/settings" element={<AdminCrmSettingsPage />} />
                <Route path="ticketing" element={<Navigate to="/admin/crm/ticketing" replace />} />
                <Route path="ticketing/*" element={<Navigate to="/admin/crm/ticketing" replace />} />

              </Route>
            </Route>

            <Route path="*" element={<RedirectWithTagAssistant to="/" />} />
          </Routes>
        </Suspense>
        <LandingMobileDock />
      </ShopCartProvider>
      </AppToastProvider>
    </AppGuards>
  );
}
