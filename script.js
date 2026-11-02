
// ==========================================
// SPENDWISE - SMART EXPENSE TRACKER
// ==========================================

// DOM ELEMENTS
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "spendwise_transactions";
const BUDGET_KEY = "spendwise_budgets";
const THEME_KEY = "spendwise_theme";

let transactions = loadData(STORAGE_KEY, []);
let budgets = loadData(BUDGET_KEY, {});
let editingId = null;

let overviewChart = null;
let categoryChart = null;
let monthlyChart = null;

const categories = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍️",
  Bills: "🧾",
  Education: "📚",
  Health: "💊",
  Salary: "💼",
  Freelance: "💻",
  Entertainment: "🎬",
  Other: "📌"
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

  $("todayDate").textContent =
    new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  $("budgetMonth").value = getCurrentMonth();

  applyTheme();
  setupNavigation();
  setupModal();
  setupForms();
  setupFilters();
  setupButtons();

  renderAll();

});

// ==========================================
// LOCAL STORAGE
// ==========================================

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error("Storage error:", error);
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getCurrentMonth() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(value + "T00:00:00");

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function formatDate(date) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getMonthTransactions(month) {
  return transactions.filter(item => item.date.startsWith(month));
}

function getExpenses(month) {
  return getMonthTransactions(month)
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
}

function getBudget(month) {
  return Number(budgets[month]) || 0;
}

function generateId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

// ==========================================
// NAVIGATION
// ==========================================

function setupNavigation() {

  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.goto);
    });
  });

}

function showPage(pageId) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const target = $(pageId);

  if (!target) return;

  target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageId
    );
  });

  const titles = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budget: "Monthly Budget",
    analytics: "Analytics"
  };

  $("pageTitle").textContent = titles[pageId] || "Dashboard";

  if (pageId === "analytics") {
    setTimeout(updateCharts, 100);
  }

}

// ==========================================
// MODAL
// ==========================================

function setupModal() {

  $("topAddButton").addEventListener("click", openAddModal);

  $("transactionAddButton").addEventListener("click", openAddModal);

  $("closeModal").addEventListener("click", closeModal);

  $("cancelButton").addEventListener("click", closeModal);

  $("transactionModal").addEventListener("click", event => {
    if (event.target === $("transactionModal")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

}

function openAddModal() {

  editingId = null;

  $("transactionForm").reset();

  $("date").value = new Date().toLocaleDateString("en-CA");

  $("modalTitle").textContent = "Add Transaction";
  $("submitButton").textContent = "Save Transaction";
  $("formMessage").textContent = "";

  $("transactionModal").classList.add("show");
  $("transactionModal").setAttribute("aria-hidden", "false");

}

function closeModal() {

  $("transactionModal").classList.remove("show");
  $("transactionModal").setAttribute("aria-hidden", "true");

  editingId = null;

}

// ==========================================
// ADD AND EDIT TRANSACTIONS
// ==========================================

function setupForms() {

  $("transactionForm").addEventListener("submit", event => {

    event.preventDefault();

    const type = $("type").value;
    const amount = Number($("amount").value);
    const category = $("category").value;
    const date = $("date").value;
    const description = $("description").value.trim();

    if (!["income", "expense"].includes(type)) {
      showFormMessage("Invalid transaction type.", true);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
      showFormMessage("Please enter a valid amount.", true);
      return;
    }

    if (!isValidDate(date)) {
      showFormMessage("Please select a valid date.", true);
      return;
    }

    if (!description || description.length > 100) {
      showFormMessage("Please enter a valid description.", true);
      return;
    }

    const transaction = {
      id: editingId || generateId(),
      type,
      amount: Math.round(amount * 100) / 100,
      category,
      date,
      description
    };

    if (editingId) {

      const index = transactions.findIndex(
        item => item.id === editingId
      );

      if (index !== -1) {
        transactions[index] = transaction;
      }

    } else {

      transactions.push(transaction);

    }

    saveData();
    renderAll();
    closeModal();

  });

  $("budgetForm").addEventListener("submit", event => {

    event.preventDefault();

    const month = $("budgetMonth").value;
    const amount = Number($("budgetAmount").value);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      showBudgetMessage("Please select a valid month.", true);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
      showBudgetMessage("Please enter a valid budget.", true);
      return;
    }

    budgets[month] = Math.round(amount * 100) / 100;

    saveData();
    renderAll();

    showBudgetMessage("✓ Monthly budget saved successfully!");

  });

}

function showFormMessage(message, error = false) {

  $("formMessage").textContent = message;
  $("formMessage").style.color = error ? "#ed6475" : "#16a879";

}

function showBudgetMessage(message, error = false) {

  $("budgetMessage").textContent = message;
  $("budgetMessage").style.color = error ? "#ed6475" : "#16a879";

}

// ==========================================
// EDIT TRANSACTION
// ==========================================

function editTransaction(id) {

  const transaction = transactions.find(
    item => item.id === id
  );

  if (!transaction) return;

  editingId = id;

  $("type").value = transaction.type;
  $("amount").value = transaction.amount;
  $("category").value = transaction.category;
  $("date").value = transaction.date;
  $("description").value = transaction.description;

  $("modalTitle").textContent = "Edit Transaction";
  $("submitButton").textContent = "Update Transaction";
  $("formMessage").textContent = "";

  $("transactionModal").classList.add("show");
  $("transactionModal").setAttribute("aria-hidden", "false");

}

// ==========================================
// DELETE TRANSACTION
// ==========================================

function deleteTransaction(id) {

  const confirmed = confirm(
    "Are you sure you want to delete this transaction?"
  );

  if (!confirmed) return;

  transactions = transactions.filter(
    item => item.id !== id
  );

  saveData();
  renderAll();

}

// ==========================================
// FILTER AND SEARCH
// ==========================================

function setupFilters() {

  $("search").addEventListener("input", renderTransactions);

  $("filter").addEventListener("change", renderTransactions);

  $("monthFilter").addEventListener("change", renderTransactions);

}

function updateMonthFilter() {

  const select = $("monthFilter");
  const currentValue = select.value;

  const months = [...new Set(
    transactions.map(item => item.date.slice(0, 7))
  )].sort().reverse();

  select.innerHTML = '<option value="all">All months</option>';

  months.forEach(month => {

    const option = document.createElement("option");

    option.value = month;

    option.textContent = new Date(
      month + "-01T00:00:00"
    ).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });

    select.appendChild(option);

  });

  select.value = months.includes(currentValue)
    ? currentValue
    : "all";

}

function getFilteredTransactions() {

  const search = $("search").value.toLowerCase().trim();
  const filter = $("filter").value;
  const month = $("monthFilter").value;

  return [...transactions]
    .filter(item => {

      const matchesSearch =
        item.description.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search);

      const matchesType =
        filter === "all" || item.type === filter;

      const matchesMonth =
        month === "all" || item.date.startsWith(month);

      return matchesSearch && matchesType && matchesMonth;

    })
    .sort((a, b) => b.date.localeCompare(a.date));

}

// ==========================================
// RENDER ALL
// ==========================================

function renderAll() {

  updateDashboard();
  updateBudget();
  updateMonthFilter();
  renderTransactions();
  renderRecentTransactions();
  updateCharts();
  renderCategoryBreakdown();

}

// ==========================================
// DASHBOARD
// ==========================================

function updateDashboard() {

  const income = transactions
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expenses = transactions
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const balance = income - expenses;

  $("balance").textContent = formatMoney(balance);
  $("income").textContent = formatMoney(income);
  $("expenses").textContent = formatMoney(expenses);

  const month = getCurrentMonth();
  const spent = getExpenses(month);
  const limit = getBudget(month);
  const remaining = limit - spent;

  const percentage = limit > 0
    ? Math.round(spent / limit * 100)
    : 0;

  $("budgetPercent").textContent =
    percentage + "%";

  $("budgetCircle").style.background = limit > 0
    ? `conic-gradient(
        ${percentage > 100 ? "#ed6475" : "#6558e8"}
        ${Math.min(percentage, 100) * 3.6}deg,
        var(--border) 0deg
      )`
    : "var(--border)";

  $("miniSpent").textContent = formatMoney(spent);

  $("miniRemaining").textContent = limit > 0
    ? formatMoney(remaining)
    : "Not set";

}

// ==========================================
// BUDGET
// ==========================================

function updateBudget() {

  const month = $("budgetMonth").value || getCurrentMonth();

  const limit = getBudget(month);
  const spent = getExpenses(month);
  const remaining = limit - spent;

  const percentage = limit > 0
    ? Math.round(spent / limit * 100)
    : 0;

  $("budgetLimit").textContent = formatMoney(limit);
  $("budgetSpent").textContent = formatMoney(spent);

  $("budgetRemaining").textContent = formatMoney(remaining);

  $("budgetProgressFill").style.width =
    `${Math.min(percentage, 100)}%`;

  $("budgetProgressFill").style.background =
    percentage > 100 ? "#ed6475" : "#6558e8";

  $("budgetProgressText").textContent =
    limit > 0
      ? `${percentage}% of your monthly budget used`
      : "Set a budget to begin.";

  if (limit === 0) {

    $("budgetTip").textContent =
      "💡 Set your monthly budget to monitor your expenses.";

  } else if (percentage > 100) {

    $("budgetTip").textContent =
      `⚠️ You exceeded your budget by ${formatMoney(spent - limit)}.`;

  } else if (percentage >= 80) {

    $("budgetTip").textContent =
      "⚠️ You are close to your budget limit. Control your spending.";

  } else {

    $("budgetTip").textContent =
      `✓ Great! You have ${formatMoney(remaining)} left in your budget.`;

  }

}

// ==========================================
// TRANSACTION TABLE
// ==========================================

function renderTransactions() {

  const list = getFilteredTransactions();

  $("transactionTable").innerHTML = list.map(item => `

    <tr>
      <td>${escapeHTML(item.description)}</td>

      <td>
        ${categories[item.category] || "📌"}
        ${escapeHTML(item.category)}
      </td>

      <td>
        <span class="type-badge ${item.type}">
          ${item.type}
        </span>
      </td>

      <td>${formatDate(item.date)}</td>

      <td class="${item.type === "income" ? "amount-income" : "amount-expense"}">
        ${item.type === "income" ? "+" : "-"}${formatMoney(item.amount)}
      </td>

      <td>
        <button class="action-button edit-button"
          data-action="edit" data-id="${escapeHTML(item.id)}"
          aria-label="Edit transaction">✎</button>

        <button class="action-button delete-button"
          data-action="delete" data-id="${escapeHTML(item.id)}"
          aria-label="Delete transaction">✕</button>
      </td>
    </tr>

  `).join("");

  $("transactionEmpty").hidden = list.length > 0;

  $("transactionCount").textContent =
    `${list.length} transaction${list.length !== 1 ? "s" : ""}`;

}

function renderRecentTransactions() {

  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  $("recentTransactions").innerHTML = recent.map(item => `

    <tr>
      <td>${escapeHTML(item.description)}</td>

      <td>
        ${categories[item.category] || "📌"}
        ${escapeHTML(item.category)}
      </td>

      <td>${formatDate(item.date)}</td>

      <td class="${item.type === "income" ? "amount-income" : "amount-expense"}">
        ${item.type === "income" ? "+" : "-"}${formatMoney(item.amount)}
      </td>
    </tr>

  `).join("");

  $("recentEmpty").hidden = recent.length > 0;

}

// Event delegation for edit/delete buttons.
$("transactionTable").addEventListener("click", event => {

  const button = event.target.closest("[data-action]");

  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "edit") {
    editTransaction(id);
  }

  if (button.dataset.action === "delete") {
    deleteTransaction(id);
  }

});

// ==========================================
// CATEGORY BREAKDOWN
// ==========================================

function renderCategoryBreakdown() {

  const expenses = transactions.filter(
    item => item.type === "expense"
  );

  const total = expenses.reduce(
    (sum, item) => sum + item.amount, 0
  );

  const groups = {};

  expenses.forEach(item => {

    groups[item.category] =
      (groups[item.category] || 0) + item.amount;

  });

  const sorted = Object.entries(groups)
    .sort((a, b) => b[1] - a[1]);

  $("categoryBreakdown").innerHTML = sorted.map(
    ([category, amount]) => {

      const percentage = total > 0
        ? (amount / total * 100)
        : 0;

      return `

        <div class="category-row">

          <span>
            ${categories[category] || "📌"}
            ${escapeHTML(category)}
          </span>

          <div class="category-track">
            <div class="category-fill"
              style="width:${percentage}%">
            </div>
          </div>

          <span class="category-amount">
            ${formatMoney(amount)}
          </span>

        </div>

      `;

    }
  ).join("");

  $("categoryEmpty").hidden = sorted.length > 0;

}

// ==========================================
// CHARTS
// ==========================================

function updateCharts() {

  if (typeof Chart === "undefined") return;

  const month = getCurrentMonth();
  const monthData = getMonthTransactions(month);

  const monthIncome = monthData
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const monthExpense = monthData
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const chartColors = [
    "#6558e8",
    "#16a879",
    "#ed6475",
    "#f3b84d",
    "#35a8d5",
    "#a77cf4",
    "#e98bb2",
    "#75869f",
    "#40b9ad",
    "#bd9a60"
  ];

  const textColor = getComputedStyle(document.body)
    .getPropertyValue("--muted").trim();

  const gridColor = getComputedStyle(document.body)
    .getPropertyValue("--border").trim();

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          usePointStyle: true,
          padding: 18
        }
      }
    }
  };

  // Dashboard overview chart

  if ($("overviewChart")) {

    if (overviewChart) overviewChart.destroy();

    overviewChart = new Chart($("overviewChart"), {

      type: "bar",

      data: {
        labels: ["Income", "Expenses"],

        datasets: [{
          label: "Amount (₹)",
          data: [monthIncome, monthExpense],
          backgroundColor: ["#16a879", "#ed6475"],
          borderRadius: 8,
          barThickness: 45
        }]
      },

      options: {
        ...commonOptions,
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor
            },
            grid: { color: gridColor }
          }
        }
      }

    });

  }

  // Category doughnut chart

  if ($("categoryChart")) {

    const groups = {};

    transactions
      .filter(item => item.type === "expense")
      .forEach(item => {

        groups[item.category] =
          (groups[item.category] || 0) + item.amount;

      });

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart($("categoryChart"), {

      type: "doughnut",

      data: {
        labels: Object.keys(groups),

        datasets: [{
          data: Object.values(groups),
          backgroundColor: chartColors,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },

      options: {
        ...commonOptions,
        cutout: "65%"
      }

    });

  }

  // Monthly comparison chart

  if ($("monthlyChart")) {

    const months = [];

    for (let i = 5; i >= 0; i--) {

      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);

      months.push({
        key: `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`,

        label: date.toLocaleDateString("en-IN", {
          month: "short"
        })
      });

    }

    const incomeData = [];
    const expenseData = [];

    months.forEach(month => {

      const items = getMonthTransactions(month.key);

      incomeData.push(
        items.filter(item => item.type === "income")
          .reduce((sum, item) => sum + item.amount, 0)
      );

      expenseData.push(
        items.filter(item => item.type === "expense")
          .reduce((sum, item) => sum + item.amount, 0)
      );

    });

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart($("monthlyChart"), {

      type: "line",

      data: {
        labels: months.map(item => item.label),

        datasets: [
          {
            label: "Income",
            data: incomeData,
            borderColor: "#16a879",
            backgroundColor: "rgba(22,168,121,.12)",
            fill: true,
            tension: .35
          },
          {
            label: "Expenses",
            data: expenseData,
            borderColor: "#ed6475",
            backgroundColor: "rgba(237,100,117,.10)",
            fill: true,
            tension: .35
          }
        ]
      },

      options: {
        ...commonOptions,
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      }

    });

  }

}

// ==========================================
// CSV EXPORT
// ==========================================

function setupButtons() {

  $("exportButton").addEventListener("click", exportCSV);

  $("themeToggle").addEventListener("click", toggleTheme);

  $("budgetMonth").addEventListener("change", () => {
    $("budgetAmount").value =
      getBudget($("budgetMonth").value) || "";

    $("budgetMessage").textContent = "";

    updateBudget();
  });

  $("budgetAmount").value =
    getBudget(getCurrentMonth()) || "";

}

function exportCSV() {

  const list = getFilteredTransactions();

  if (list.length === 0) {
    alert("No transactions available to export.");
    return;
  }

  const rows = [
    ["Description", "Category", "Type", "Date", "Amount"]
  ];

  list.forEach(item => {

    rows.push([
      item.description,
      item.category,
      item.type,
      item.date,
      item.amount
    ]);

  });

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "SpendWise-Transactions.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

}

// ==========================================
// DARK / LIGHT MODE
// ==========================================

function applyTheme() {

  const theme = localStorage.getItem(THEME_KEY) || "light";

  document.body.classList.toggle("dark", theme === "dark");

  $("themeToggle").textContent =
    theme === "dark" ? "☀ Light Mode" : "☾ Dark Mode";

}

function toggleTheme() {

  const isDark = document.body.classList.toggle("dark");

  localStorage.setItem(
    THEME_KEY,
    isDark ? "dark" : "light"
  );

  $("themeToggle").textContent =
    isDark ? "☀ Light Mode" : "☾ Dark Mode";

  updateCharts();

}
