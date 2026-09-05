import { BarChart3, CheckCircle2, Clock3, Eye, LogOut, Pencil, Plus, Search, Target, Trash2, UserPlus, Users, UserRound } from "lucide-react";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { logout } from "../features/auth/authSlice";
import { fetchDashboardStats, fetchLeads, createLead, deleteLead, updateLead } from "../features/crm/crmSlice";
import LeadModal from "../components/LeadModal";

const statusStyles = {
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-700",
  qualified: "bg-purple-50 text-purple-700",
  converted: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
}; // Styles for different lead statuses, used to display status badges with appropriate colors

// DashboardPage component displays the dashboard with lead statistics and a list of leads. It allows users to search, filter, create, edit, and delete leads. The component fetches data from the Redux store and handles user interactions such as opening modals and logging out.
function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const { user } = useSelector((state) => state.auth);

  const { leads, stats, isLoadingLeads, isLoadingStats, isSavingLead, error } = useSelector((state) => state.crm);

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchLeads());
  }, [dispatch]); // Fetch dashboard statistics and leads when the component mounts

  const handleSearch = (event) => {
    event.preventDefault();

    dispatch(fetchLeads({
      search: search.trim(),
      status,
    }));
  }; // Handle the search form submission by dispatching an action to fetch leads based on the search query and selected status

  const handleStatusChange = (event) => {
    const selectedStatus = event.target.value;

    setStatus(selectedStatus);

    dispatch(fetchLeads({
      search: search.trim(),
      status: selectedStatus,
    }));
  }; // Handle the status filter change by updating the state and dispatching an action to fetch leads based on the selected status and current search query

  const refreshDashboard = async () => {
    await Promise.all([
      dispatch(fetchLeads({
        search: search.trim(),
        status,
      })),
      dispatch(fetchDashboardStats()),
    ]);
  }; // Refresh the dashboard by fetching both leads and dashboard statistics concurrently, ensuring the displayed data is up-to-date after any changes such as creating, updating, or deleting leads

  const openCreateModal = () => {
    setEditingLead(null);
    setIsLeadModalOpen(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setIsLeadModalOpen(true);
  };

  const closeLeadModal = () => {
    if (!isSavingLead) {
      setEditingLead(null);
      setIsLeadModalOpen(false);
    }
  };

  // Handle saving a lead (create or update)
  const handleSaveLead = async (leadData) => {
    try {
      if (editingLead) {
        await dispatch(updateLead({
          id: editingLead._id,
          leadData,
        })).unwrap();
      } else {
        await dispatch(createLead(leadData)).unwrap();
      }

      setEditingLead(null);
      setIsLeadModalOpen(false);

      await refreshDashboard();
    } catch {
      // Redux displays the API error in the modal.
    }
  };

  // Handle deleting a lead
  const handleDeleteLead = async (lead) => {
    const shouldDelete = window.confirm(`Delete the lead "${lead.name}"?`);

    if (!shouldDelete) {
      return;
    }

    try {
      await dispatch(deleteLead(lead._id)).unwrap();
      await refreshDashboard();
    } catch {
      // Redux displays the API error.
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  // Define the statistics cards to be displayed on the dashboard, each with a label, value, icon, and styling for the icon
  const statCards = [
    {
      label: "Total Leads",
      value: stats.total,
      icon: Users,
      iconStyle: "bg-blue-100 text-blue-700",
    },
    {
      label: "New Leads",
      value: stats.new,
      icon: UserPlus,
      iconStyle: "bg-cyan-100 text-cyan-700",
    },
    {
      label: "Converted",
      value: stats.converted,
      icon: CheckCircle2,
      iconStyle: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Conversion Rate",
      value: `${stats.conversionRate}%`,
      icon: Target,
      iconStyle: "bg-purple-100 text-purple-700",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="h-10 w-10" />

            <div>
              <h1 className="text-lg font-bold text-slate-900">
                LeadFlow
              </h1>

              <p className="text-xs text-slate-500">
                Lead Management Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {user?.name}
              </p>

              <p className="text-xs capitalize text-slate-500">
                {user?.systemRole}
              </p>
            </div>

            <button type="button" onClick={() => navigate("/profile")}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <UserRound size={17} />
              <span className="hidden sm:inline">
                Profile
              </span>
            </button>

            <button onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut size={17} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h2>

          <p className="mt-1 text-slate-500">
            Monitor your lead pipeline and follow-ups.
          </p>
        </section>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      {card.label}
                    </p>

                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {isLoadingStats ? "—" : card.value}
                    </p>
                  </div>

                  <div className={`rounded-xl p-3 ${card.iconStyle}`} >
                    <Icon size={22} />
                  </div>
                </div>
              </article>
            ); // Render each statistics card with its label, value, and icon, applying appropriate styles for the icon based on the card's data
          })}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="rounded-xl bg-orange-100 p-3 text-orange-700">
              <Clock3 size={22} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Upcoming follow-ups
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {stats.upcomingFollowUps}
              </p>
            </div>
          </article>

          <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="rounded-xl bg-red-100 p-3 text-red-700">
              <Clock3 size={22} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Overdue follow-ups
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {stats.overdueFollowUps}
              </p>
            </div>
          </article>
        </section>

        <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Leads
                </h3>

                <p className="text-sm text-slate-500">
                  View and manage your lead records.
                </p>
              </div>

              <button type="button" onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <Plus size={18} />
                New Lead
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row" >
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 outline-none focus:border-blue-500 sm:w-64"
                />
              </div>

              <select value={status} onChange={handleStatusChange}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-blue-500"
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>

              <button type="submit" className="rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white hover:bg-blue-800 cursor-pointer" >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Lead</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">Source</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Follow-up</th>
                  <th className="px-5 py-4">Assigned to</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoadingLeads ? (
                  <tr>
                    <td colSpan="7" className="px-5 py-10 text-center text-slate-500" >
                      Loading leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-5 py-10 text-center text-slate-500" >
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-slate-50" >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {lead.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          {lead.email || "No email"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {lead.phone}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {lead.source}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[lead.status] ||
                          "bg-slate-100 text-slate-700"
                          }`} >
                          {lead.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {lead.nextFollowUp
                          ? new Date(
                            lead.nextFollowUp
                          ).toLocaleDateString()
                          : "Not scheduled"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {lead.assignedTo?.name || "Unassigned"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => navigate(`/leads/${lead._id}`)} title="View lead details"
                            className="cursor-pointer rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-700"
                          >
                            <Eye size={17} />
                          </button>

                          <button type="button" onClick={() => openEditModal(lead)} title="Edit lead" className="rounded-lg p-2 text-blue-700 hover:bg-blue-50 cursor-pointer" >
                            <Pencil size={17} />
                          </button>

                          <button type="button" onClick={() => handleDeleteLead(lead)} title="Delete lead" className="rounded-lg p-2 text-red-600 hover:bg-red-50 cursor-pointer" >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <LeadModal
        isOpen={isLeadModalOpen}
        lead={editingLead}
        isSaving={isSavingLead}
        error={error}
        onClose={closeLeadModal}
        onSave={handleSaveLead}
      />
    </div>
  ); // Render the dashboard page with header, statistics cards, lead list, and modals for creating/editing leads
}

export default DashboardPage;
