import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppGuards } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { RouteSeo } from './components/RouteSeo';
import { ShopCartProvider } from './hooks/useShopCart';
import { AppToastProvider } from './hooks/useAppToast';
import { LandingMobileDock } from './components/LandingMobileDock';
import { ScrollToTop } from './components/ScrollToTop';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/auth/LoginPage';

/* Heavy / rarely-first routes — keep welcome + login in the main chunk. */
const OtpPage = lazy(() => import('./pages/auth/OtpPage').then((m) => ({ default: m.OtpPage })));
const TelegramLinkPage = lazy(() =>
  import('./pages/auth/TelegramLinkPage').then((m) => ({ default: m.TelegramLinkPage })),
);
const FaqPage = lazy(() => import('./pages/FaqPage').then((m) => ({ default: m.FaqPage })));
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
const VetConsultPage = lazy(() =>
  import('./pages/VetConsultPage').then((m) => ({ default: m.VetConsultPage })),
);
const TrainerConsultPage = lazy(() =>
  import('./pages/ServiceConsultPage').then((m) => ({ default: m.TrainerConsultPage })),
);
const SitterConsultPage = lazy(() =>
  import('./pages/ServiceConsultPage').then((m) => ({ default: m.SitterConsultPage })),
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

function RouteFallback() {
  return <div className="pd-route-fallback" aria-hidden="true" />;
}

export default function App() {
  return (
    <AppGuards>
      <AppToastProvider>
      <ShopCartProvider>
        <ScrollToTop />
        <RouteSeo />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route index element={<WelcomePage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="adoption/:slug" element={<AdoptionDetailPage />} />
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
              <Route path="explore" element={<Navigate to="/chats" replace />} />
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
              <Route path="earn" element={<Navigate to="/wallet/earn" replace />} />
              <Route path="vet-consult" element={<VetConsultPage />} />
              <Route path="trainer-consult" element={<TrainerConsultPage />} />
              <Route path="sitter-consult" element={<SitterConsultPage />} />
              <Route path="vet-chats" element={<Navigate to="/vet-consult" replace />} />
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
                <Route path="content" element={<AdminContentPage />} />
                <Route path="mail" element={<AdminMailPage />} />
                <Route path="logs" element={<AdminLogsPage />} />
                <Route path="monitoring" element={<AdminMonitoringPage />} />
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
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <LandingMobileDock />
      </ShopCartProvider>
      </AppToastProvider>
    </AppGuards>
  );
}
