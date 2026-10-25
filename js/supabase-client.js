/**
 * supabase-client.js - Direct Supabase Client and API Layer for CHAYA ERP
 * Provides ultra-fast direct PostgreSQL database operations (100-200ms)
 * Completely eliminates Google Apps Script latency.
 */

const SUPABASE_CONFIG = {
  URL: "https://asdotsuehnvempknlezy.supabase.co",
  ANON_KEY: "sb_publishable_6T2sbZMMtEqrr_CQt4XWRw_Jto1KE-V",
};

const SupabaseAPI = {
  headers: function () {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("sgd_token") : null;
    const headers = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_CONFIG.ANON_KEY,
      "Authorization": "Bearer " + (token && token.startsWith("eyJ") ? token : SUPABASE_CONFIG.ANON_KEY),
      "Prefer": "return=representation",
    };
    return headers;
  },

  restUrl: function (table, query = "") {
    return `${SUPABASE_CONFIG.URL}/rest/v1/${table}${query ? "?" + query : ""}`;
  },

  toISODate: function (val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (!str) return null;

    // Matches DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      const d = dmy[1].padStart(2, "0");
      const m = dmy[2].padStart(2, "0");
      const y = dmy[3];
      return `${y}-${m}-${d}`;
    }

    // Matches YYYY-MM-DD
    const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymd) {
      const y = ymd[1];
      const m = ymd[2].padStart(2, "0");
      const d = ymd[3].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return str;
  },

  currentISODate: function () {
    const now = new Date();
    return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  },

  currentISOTime: function () {
    return new Date().toISOString();
  },

  extractStateCode: function (val, gstin) {
    if (gstin && String(gstin).trim().length >= 2 && /^\d{2}/.test(String(gstin).trim())) {
      return String(gstin).trim().slice(0, 2);
    }
    if (!val) return "19";
    const str = String(val).trim();
    if (/^\d{1,2}$/.test(str)) return str.padStart(2, "0");
    const match = str.match(/\((\d{1,2})\)/);
    if (match) return match[1].padStart(2, "0");
    const stateMap = {
      "andhra pradesh": "37", "arunachal pradesh": "12", "assam": "18", "bihar": "10",
      "chhattisgarh": "22", "delhi": "07", "dl": "07", "goa": "30", "gujarat": "24",
      "haryana": "06", "himachal pradesh": "02", "jammu and kashmir": "01", "jharkhand": "20",
      "karnataka": "29", "ka": "29", "kerala": "32", "madhya pradesh": "23", "mp": "23",
      "maharashtra": "27", "mh": "27", "manipur": "14", "meghalaya": "17", "mizoram": "15",
      "nagaland": "13", "odisha": "21", "orissa": "21", "punjab": "03", "rajasthan": "08",
      "rj": "08", "sikkim": "11", "tamil nadu": "33", "tn": "33", "telangana": "36",
      "tripura": "16", "uttar pradesh": "09", "up": "09", "uttarakhand": "05",
      "west bengal": "19", "wb": "19"
    };
    const lower = str.toLowerCase();
    if (stateMap[lower]) return stateMap[lower];
    return str.slice(0, 10);
  },

  /**
   * Generic REST Fetcher
   */
  fetch: async function (table, query = "", options = {}) {
    const url = this.restUrl(table, query);
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers(), ...(options.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || err.error || "Supabase query error");
    }
    return await res.json();
  },

  /**
   * AUTHENTICATION: Login check
   */
  login: async function (username, password) {
    const rows = await this.fetch(
      "users",
      `username=eq.${encodeURIComponent(username)}&status=eq.active&select=*`
    );

    if (!rows || rows.length === 0) {
      return { success: false, message: "User not found or inactive." };
    }

    const user = rows[0];
    // Check plain password or hash match
    if (user.password_hash !== password) {
      return { success: false, message: "Invalid password." };
    }

    const permissions = typeof user.permissions === "string" 
      ? JSON.parse(user.permissions) 
      : (user.permissions || {});

    // Normalize user object matching Frontend expectations
    const normalizedUser = {
      userId: user.user_id,
      UserID: user.user_id,
      fullName: user.full_name,
      FullName: user.full_name,
      username: user.username,
      Username: user.username,
      role: user.role,
      Role: user.role,
      permissions: permissions,
      Permissions: permissions,
      status: user.status,
    };

    return {
      success: true,
      message: "Login successful",
      user: normalizedUser,
      token: "sb_user_" + user.user_id + "_" + Date.now(),
      data: {
        user: normalizedUser,
        token: "sb_user_" + user.user_id + "_" + Date.now(),
      },
    };
  },

  /**
   * DASHBOARD DATA
   */
  getDashboardData: async function () {
    const [sales, purchases, parties, items] = await Promise.all([
      this.fetch("sales", "status=eq.Active&select=*"),
      this.fetch("purchases", "status=eq.Active&select=*"),
      this.fetch("parties", "status=eq.Active&select=*"),
      this.fetch("items", "status=eq.Active&select=*"),
    ]);

    const todayStr = this.currentISODate();
    const thisMonthStr = todayStr.slice(0, 7);

    let todaySales = 0;
    let monthSales = 0;
    sales.forEach((s) => {
      const d = (s.invoice_date || "").slice(0, 10);
      const amt = parseFloat(s.total_amount || 0);
      if (d === todayStr) todaySales += amt;
      if (d.startsWith(thisMonthStr)) monthSales += amt;
    });

    let totalReceivables = 0;
    let totalPayables = 0;
    parties.forEach((p) => {
      const bal = parseFloat(p.current_balance || 0);
      const type = (p.balance_type || "Dr").toUpperCase();
      if (type === "DR") totalReceivables += Math.abs(bal);
      else totalPayables += Math.abs(bal);
    });

    // 6 Months Sales & Purchase trends
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartMonths = [];
    const salesTrends = [];
    const purchaseTrends = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      chartMonths.push(monthNames[d.getMonth()]);

      let mSales = 0;
      sales.forEach((s) => {
        if ((s.invoice_date || "").startsWith(ym)) mSales += parseFloat(s.total_amount || 0);
      });
      salesTrends.push(mSales);

      let mPurchases = 0;
      purchases.forEach((p) => {
        if ((p.bill_date || "").startsWith(ym)) mPurchases += parseFloat(p.total_amount || 0);
      });
      purchaseTrends.push(mPurchases);
    }

    return {
      success: true,
      data: {
        todaySales,
        monthSales,
        totalReceivables,
        totalPayables,
        chartData: {
          months: chartMonths,
          sales: salesTrends,
          purchases: purchaseTrends,
          topItems: {
            labels: items.slice(0, 5).map((i) => i.item_name),
            data: items.slice(0, 5).map((i) => parseFloat(i.current_stock || 0)),
          },
        },
      },
    };
  },

  /**
   * ITEMS / INVENTORY
   */
  getItems: async function (payload = {}) {
    let q = "order=created_at.desc&select=*";
    if (payload.activeOnly) q += "&status=eq.Active";

    const rows = await this.fetch("items", q);
    const data = rows.map((i) => ({
      id: i.item_id,
      id_num: i.id,
      itemId: i.item_id,
      ItemID: i.item_id,
      itemCode: i.item_id,
      itemName: i.item_name,
      ItemName: i.item_name,
      category: i.category,
      Category: i.category,
      hsn: i.hsn_code,
      HSNCode: i.hsn_code,
      stock: parseFloat(i.current_stock || 0),
      currentStock: parseFloat(i.current_stock || 0),
      CurrentStock: parseFloat(i.current_stock || 0),
      minStock: parseFloat(i.min_stock || 0),
      MinStock: parseFloat(i.min_stock || 0),
      unit: i.unit,
      Unit: i.unit,
      purchasePrice: parseFloat(i.purchase_price || 0),
      PurchasePrice: parseFloat(i.purchase_price || 0),
      sellingPrice: parseFloat(i.selling_price || 0),
      SellingPrice: parseFloat(i.selling_price || 0),
      gst: parseFloat(i.gst_percent || 0),
      GSTPercent: parseFloat(i.gst_percent || 0),
      status: i.status,
      Status: i.status,
      imageUrl: i.image_url || i.imageUrl || i.image || "",
      image_url: i.image_url || i.imageUrl || i.image || "",
    }));
    return { success: true, data };
  },

  saveItem: async function (payload) {
    const editId = payload.itemId || payload.ItemID || payload.id;
    const isEdit = !!editId;
    let itemId = editId;

    if (!isEdit) {
      // Generate sequential ID
      let nextNum = 1;
      try {
        const countRes = await this.fetch("items", "select=id&order=id.desc&limit=1");
        nextNum = (countRes && countRes[0] && countRes[0].id ? countRes[0].id : 0) + 1;
      } catch (e) {
        nextNum = Math.floor(Math.random() * 9000) + 1000;
      }
      itemId = "ITM-" + String(nextNum).padStart(4, "0");
    }

    const imgUrl = payload.imageUrl || payload.image_url || payload.image || "";

    const record = {
      item_id: itemId,
      item_name: payload.itemName || payload.ItemName || "",
      category: payload.category || payload.Category || "Other",
      hsn_code: payload.hsn || payload.hsnCode || payload.HSNCode || "",
      current_stock: parseFloat(payload.currentStock || payload.stock || payload.CurrentStock || 0),
      min_stock: parseFloat(payload.minStock || payload.MinStock || 0),
      unit: payload.unit || payload.Unit || "PCS",
      purchase_price: parseFloat(payload.purchasePrice || payload.PurchasePrice || 0),
      selling_price: parseFloat(payload.sellingPrice || payload.SellingPrice || 0),
      gst_percent: parseFloat(payload.gstPercent || payload.gst || payload.GSTPercent || 18),
      status: payload.status || payload.Status || "Active",
      image_url: imgUrl,
      updated_at: new Date().toISOString(),
    };

    if (isEdit) {
      try {
        await this.fetch(`items?item_id=eq.${encodeURIComponent(itemId)}`, "", {
          method: "PATCH",
          body: JSON.stringify(record),
        });
      } catch (err) {
        // If image_url column doesn't exist yet, retry without image_url
        if (String(err.message || "").toLowerCase().includes("image_url")) {
          delete record.image_url;
          await this.fetch(`items?item_id=eq.${encodeURIComponent(itemId)}`, "", {
            method: "PATCH",
            body: JSON.stringify(record),
          });
        } else {
          throw err;
        }
      }
    } else {
      record.created_at = new Date().toISOString();
      try {
        await this.fetch("items", "", {
          method: "POST",
          body: JSON.stringify(record),
        });
      } catch (err) {
        // If image_url column doesn't exist yet, retry without image_url
        if (String(err.message || "").toLowerCase().includes("image_url")) {
          delete record.image_url;
          await this.fetch("items", "", {
            method: "POST",
            body: JSON.stringify(record),
          });
        } else {
          throw err;
        }
      }
    }

    return { success: true, message: "Item saved successfully", data: { itemId, imageUrl: imgUrl } };
  },

  deleteItem: async function (payload) {
    const itemId = payload.itemId || payload.ItemID || payload.id;
    await this.fetch(`items?item_id=eq.${encodeURIComponent(itemId)}`, "", {
      method: "DELETE",
    });
    return { success: true, message: "Item deleted successfully" };
  },

  /**
   * CATEGORIES (Dynamic Supabase PostgreSQL Table)
   */
  getCategories: async function () {
    try {
      const rows = await this.fetch("categories", "status=eq.active&order=category_name.asc&select=*");
      if (Array.isArray(rows) && rows.length > 0) {
        return { success: true, data: rows.map((r) => r.category_name) };
      }
    } catch (e) {
      console.warn("Categories table fetch fallback:", e);
    }

    const defaultCategories = [
      "Fluted Panel",
      "UV Sheet",
      "PVC Flooring",
      "Wallpaper",
      "Moulding",
      "Trim Profile",
      "Adhesive",
      "Wall Sticker",
      "Hardware",
      "Other",
    ];
    return { success: true, data: defaultCategories };
  },

  saveCategory: async function (payload) {
    const catName = (payload.category || payload.name || "").trim();
    if (!catName) {
      return { success: false, message: "Category name is required" };
    }
    try {
      await this.fetch("categories", "", {
        method: "POST",
        body: JSON.stringify({ category_name: catName, status: "active" }),
      });
      return { success: true, message: `Category "${catName}" added successfully` };
    } catch (e) {
      return { success: false, message: e.message || "Error saving category" };
    }
  },

  deleteCategory: async function (payload) {
    const catName = (payload.category || payload.name || "").trim();
    try {
      await this.fetch(`categories?category_name=eq.${encodeURIComponent(catName)}`, "", {
        method: "DELETE",
      });
      return { success: true, message: `Category "${catName}" deleted successfully` };
    } catch (e) {
      return { success: false, message: e.message || "Error deleting category" };
    }
  },

  /**
   * UNITS (Dynamic Supabase PostgreSQL Table)
   */
  getUnits: async function () {
    try {
      const rows = await this.fetch("units", "status=eq.active&order=unit_code.asc&select=*");
      if (Array.isArray(rows) && rows.length > 0) {
        return { success: true, data: rows };
      }
    } catch (e) {
      console.warn("Units table fetch fallback:", e);
    }
    return {
      success: true,
      data: [
        { unit_code: "PCS", unit_name: "Pieces" },
        { unit_code: "ROL", unit_name: "Rolls" },
        { unit_code: "SQF", unit_name: "Square Feet" },
        { unit_code: "MTR", unit_name: "Meters" },
        { unit_code: "BOX", unit_name: "Boxes" },
        { unit_code: "KG",  unit_name: "Kilograms" },
        { unit_code: "LTR", unit_name: "Liters" },
        { unit_code: "SET", unit_name: "Sets" },
      ],
    };
  },

  /**
   * COMPANY SETTINGS (Dynamic Supabase PostgreSQL Table)
   */
  getSettings: async function () {
    try {
      const rows = await this.fetch("company_settings", "id=eq.1&select=*");
      if (Array.isArray(rows) && rows.length > 0) {
        const s = rows[0];
        const data = {
          CompanyName: s.company_name || "CHAYA",
          TradeName: s.trade_name || "CHAYA Wallpaper & Interior",
          Tagline: s.tagline || "Premium Wallpapers • Custom Interiors • Flooring",
          Phone: s.phone || "+91 98765 43210",
          Email: s.email || "info@chayainterior.com",
          Address: s.address || "Sector V, Salt Lake, Kolkata, West Bengal — 700091",
          City: s.city || "Kolkata",
          State: s.state || "West Bengal",
          StateCode: s.state_code || "19",
          GSTIN: s.gstin || "19ABCDE1234F1Z5",
          BankName: s.bank_name || "HDFC Bank",
          AccountNo: s.account_no || "50200012345678",
          IFSCCode: s.ifsc_code || "HDFC0001234",
          Branch: s.branch || "Salt Lake, Kolkata",
          InvoicePrefix: s.invoice_prefix || "SGD",
          FinancialYear: s.financial_year || "26-27",
          TermsConditions: s.terms_conditions || "Goods once sold will not be taken back.\nInterest @18% p.a. will be charged if payment is delayed beyond due date.\nSubject to Kolkata jurisdiction only.",
        };
        if (typeof window !== "undefined") {
          window.currentCompanySettings = data;
        }
        return { success: true, data };
      }
    } catch (e) {
      console.warn("company_settings fetch error:", e);
    }

    const fallbackData = {
      CompanyName: "CHAYA",
      TradeName: "CHAYA Wallpaper & Interior",
      Tagline: "Premium Wallpapers • Custom Interiors • Flooring",
      Phone: "+91 98765 43210",
      Email: "info@chayainterior.com",
      Address: "Sector V, Salt Lake, Kolkata, West Bengal — 700091",
      City: "Kolkata",
      State: "West Bengal",
      StateCode: "19",
      GSTIN: "19ABCDE1234F1Z5",
      BankName: "HDFC Bank",
      AccountNo: "50200012345678",
      IFSCCode: "HDFC0001234",
      Branch: "Salt Lake, Kolkata",
      InvoicePrefix: "SGD",
      FinancialYear: "26-27",
      TermsConditions: "Goods once sold will not be taken back.\nInterest @18% p.a. will be charged if payment is delayed beyond due date.\nSubject to Kolkata jurisdiction only.",
    };
    if (typeof window !== "undefined") {
      window.currentCompanySettings = fallbackData;
    }
    return { success: true, data: fallbackData };
  },

  saveSettings: async function (payload) {
    const record = {
      company_name: payload.CompanyName || payload.companyName,
      trade_name: payload.TradeName || payload.tradeName,
      tagline: payload.Tagline || payload.tagline,
      phone: payload.Phone || payload.phone,
      email: payload.Email || payload.email,
      address: payload.Address || payload.address,
      city: payload.City || payload.city,
      state: payload.State || payload.state,
      state_code: payload.StateCode || payload.stateCode,
      gstin: payload.GSTIN || payload.gstin,
      bank_name: payload.BankName || payload.bankName,
      account_no: payload.AccountNo || payload.accountNo,
      ifsc_code: payload.IFSCCode || payload.ifscCode,
      branch: payload.Branch || payload.branch,
      invoice_prefix: payload.InvoicePrefix || payload.invoicePrefix,
      financial_year: payload.FinancialYear || payload.financialYear,
      terms_conditions: payload.TermsConditions || payload.termsConditions,
      updated_at: new Date().toISOString(),
    };

    await this.fetch("company_settings?id=eq.1", "", {
      method: "PATCH",
      body: JSON.stringify(record),
    });

    if (typeof window !== "undefined") {
      window.currentCompanySettings = { ...window.currentCompanySettings, ...payload };
    }
    return { success: true, message: "Settings saved successfully" };
  },

  /**
   * PARTIES
   */
  getParties: async function (payload = {}) {
    let q = "order=party_name.asc&select=*";
    if (payload.activeOnly) q += "&status=eq.Active";
    if (payload.type) q += `&party_type=ilike.*${encodeURIComponent(payload.type)}*`;

    const rows = await this.fetch("parties", q);
    const data = rows.map((p) => ({
      id: p.party_id,
      partyId: p.party_id,
      PartyID: p.party_id,
      code: p.party_id,
      name: p.party_name,
      partyName: p.party_name,
      PartyName: p.party_name,
      type: p.party_type,
      partyType: p.party_type,
      PartyType: p.party_type,
      gstin: p.gstin || "",
      GSTIN: p.gstin || "",
      phone: p.phone || "",
      Phone: p.phone || "",
      email: p.email || "",
      address: p.address || "",
      city: p.city || "",
      City: p.city || "",
      state: p.state || "West Bengal",
      stateCode: p.state_code || "19",
      openingBalance: parseFloat(p.opening_balance || 0),
      balance: parseFloat(p.current_balance || 0),
      CurrentBalance: parseFloat(p.current_balance || 0),
      balanceType: p.balance_type || "Dr",
      BalanceType: p.balance_type || "Dr",
      status: p.status || "Active",
      Status: p.status || "Active",
    }));
    return { success: true, data };
  },

  saveParty: async function (payload) {
    const isEdit = !!payload.partyId;
    let partyId = payload.partyId;

    if (!isEdit) {
      const countRes = await this.fetch("parties", "select=id&order=id.desc&limit=1");
      const nextNum = (countRes && countRes[0] ? countRes[0].id : 0) + 1;
      partyId = "PTY-" + String(nextNum).padStart(4, "0");
    }

    const opBal = parseFloat(payload.openingBalance || 0);
    const record = {
      party_id: partyId,
      party_name: payload.partyName || payload.name,
      party_type: payload.partyType || payload.type || "Customer",
      gstin: payload.gstin || "",
      phone: payload.phone || "",
      email: payload.email || "",
      address: payload.address || "",
      city: payload.city || "",
      state: payload.state || "West Bengal",
      state_code: payload.stateCode || "19",
      opening_balance: opBal,
      current_balance: isEdit ? parseFloat(payload.currentBalance !== undefined ? payload.currentBalance : payload.balance || 0) : opBal,
      balance_type: payload.balanceType || "Dr",
      status: payload.status || "Active",
      updated_at: new Date().toISOString(),
    };

    if (isEdit) {
      await this.fetch(`parties?party_id=eq.${encodeURIComponent(partyId)}`, "", {
        method: "PATCH",
        body: JSON.stringify(record),
      });
    } else {
      record.created_at = new Date().toISOString();
      await this.fetch("parties", "", {
        method: "POST",
        body: JSON.stringify(record),
      });
    }

    return { success: true, message: "Party saved successfully", data: { partyId } };
  },

  deleteParty: async function (payload) {
    const partyId = payload.partyId || payload.id;
    await this.fetch(`parties?party_id=eq.${encodeURIComponent(partyId)}`, "", {
      method: "DELETE",
    });
    return { success: true, message: "Party deleted successfully" };
  },

  /**
   * SALES / INVOICES
   */
  getSales: async function () {
    const rows = await this.fetch("sales", "order=created_at.desc&select=*");
    const data = rows.map((s) => ({
      id: s.sale_id,
      saleId: s.sale_id,
      SaleID: s.sale_id,
      invoiceNo: s.invoice_no,
      InvoiceNo: s.invoice_no,
      date: s.invoice_date,
      InvoiceDate: s.invoice_date,
      dueDate: s.due_date,
      partyId: s.party_id,
      PartyID: s.party_id,
      customerName: s.party_name,
      PartyName: s.party_name,
      CustomerName: s.party_name,
      totalQty: parseFloat(s.total_qty || 0),
      TotalQty: parseFloat(s.total_qty || 0),
      subTotal: parseFloat(s.sub_total || 0),
      TaxableAmount: parseFloat(s.sub_total || 0),
      discountAmount: parseFloat(s.discount_amount || 0),
      DiscountAmount: parseFloat(s.discount_amount || 0),
      cgst: parseFloat(s.cgst_amount || 0),
      CGSTAmount: parseFloat(s.cgst_amount || 0),
      sgst: parseFloat(s.sgst_amount || 0),
      SGSTAmount: parseFloat(s.sgst_amount || 0),
      igst: parseFloat(s.igst_amount || 0),
      IGSTAmount: parseFloat(s.igst_amount || 0),
      taxAmount: parseFloat(s.tax_amount || 0),
      TaxAmount: parseFloat(s.tax_amount || 0),
      grandTotal: parseFloat(s.total_amount || 0),
      totalAmount: parseFloat(s.total_amount || 0),
      TotalAmount: parseFloat(s.total_amount || 0),
      amountPaid: parseFloat(s.amount_paid || 0),
      AmountPaid: parseFloat(s.amount_paid || 0),
      balance: parseFloat(s.balance_due || 0),
      status: s.payment_status || "Unpaid",
      PaymentStatus: s.payment_status || "Unpaid",
      Status: s.status || "Active",
    }));
    return { success: true, data };
  },

  getNextInvoiceNo: async function () {
    const [res, settingsRes] = await Promise.all([
      this.fetch("sales", "select=id&order=id.desc&limit=1"),
      this.getSettings(),
    ]);
    const nextNum = (res && res[0] ? res[0].id : 0) + 1;
    const s = (settingsRes && settingsRes.data) ? settingsRes.data : {};
    const prefix = s.InvoicePrefix || "SGD";
    const fy = s.FinancialYear || "26-27";
    const invNo = `${prefix}_${String(nextNum).padStart(4, "0")}_${fy}`;
    return { success: true, data: { invoiceNo: invNo } };
  },

  getSaleDetails: async function (payload) {
    const saleId = payload.saleId || payload.id;
    const [sales, items] = await Promise.all([
      this.fetch("sales", `sale_id=eq.${encodeURIComponent(saleId)}&select=*`),
      this.fetch("sale_items", `sale_id=eq.${encodeURIComponent(saleId)}&select=*`),
    ]);

    if (!sales || sales.length === 0) {
      return { success: false, message: "Invoice not found" };
    }

    const s = sales[0];
    const saleData = {
      id: s.sale_id,
      saleId: s.sale_id,
      SaleID: s.sale_id,
      invoiceNo: s.invoice_no,
      InvoiceNo: s.invoice_no,
      date: s.invoice_date,
      InvoiceDate: s.invoice_date,
      Date: s.invoice_date,
      dueDate: s.due_date,
      DueDate: s.due_date,
      partyId: s.party_id,
      PartyID: s.party_id,
      customer: s.party_name,
      customerName: s.party_name,
      PartyName: s.party_name,
      partyPhone: s.party_phone,
      Phone: s.party_phone,
      partyAddress: s.party_address,
      Address: s.party_address,
      partyGstin: s.party_gstin,
      GSTIN: s.party_gstin,
      placeOfSupply: s.place_of_supply,
      vehicleNo: s.vehicle_no,
      TransportVehicleNo: s.vehicle_no,
      totalQty: parseFloat(s.total_qty || 0),
      TotalQty: parseFloat(s.total_qty || 0),
      subTotal: parseFloat(s.sub_total || 0),
      SubTotal: parseFloat(s.sub_total || 0),
      taxableAmount: parseFloat(s.sub_total || 0),
      TaxableAmount: parseFloat(s.sub_total || 0),
      discountAmount: parseFloat(s.discount_amount || 0),
      DiscountAmount: parseFloat(s.discount_amount || 0),
      cgst: parseFloat(s.cgst_amount || 0),
      cgstAmount: parseFloat(s.cgst_amount || 0),
      CGSTAmount: parseFloat(s.cgst_amount || 0),
      sgst: parseFloat(s.sgst_amount || 0),
      sgstAmount: parseFloat(s.sgst_amount || 0),
      SGSTAmount: parseFloat(s.sgst_amount || 0),
      igst: parseFloat(s.igst_amount || 0),
      igstAmount: parseFloat(s.igst_amount || 0),
      IGSTAmount: parseFloat(s.igst_amount || 0),
      taxAmount: parseFloat(s.tax_amount || 0),
      TaxAmount: parseFloat(s.tax_amount || 0),
      roundOff: parseFloat(s.round_off || 0),
      RoundOff: parseFloat(s.round_off || 0),
      total: parseFloat(s.total_amount || 0),
      totalAmount: parseFloat(s.total_amount || 0),
      TotalAmount: parseFloat(s.total_amount || 0),
      grandTotal: parseFloat(s.total_amount || 0),
      GrandTotal: parseFloat(s.total_amount || 0),
      amountPaid: parseFloat(s.amount_paid || 0),
      AmountPaid: parseFloat(s.amount_paid || 0),
      paid: parseFloat(s.amount_paid || 0),
      balanceDue: parseFloat(s.balance_due || 0),
      BalanceDue: parseFloat(s.balance_due || 0),
      balance: parseFloat(s.balance_due || 0),
      paymentStatus: s.payment_status || "Unpaid",
      PaymentStatus: s.payment_status || "Unpaid",
      paymentMode: s.payment_mode || "Cash",
      status: s.status || "Active",
      Status: s.status || "Active",
    };

    const itemsData = (items || []).map((i) => ({
      itemId: i.item_id,
      id: i.item_id,
      itemName: i.item_name,
      ItemName: i.item_name,
      name: i.item_name,
      desc: i.item_name,
      hsn: i.hsn_code,
      hsnCode: i.hsn_code,
      HSNCode: i.hsn_code,
      quantity: parseFloat(i.quantity || 0),
      Quantity: parseFloat(i.quantity || 0),
      qty: parseFloat(i.quantity || 0),
      unit: i.unit || "PCS",
      Unit: i.unit || "PCS",
      rate: parseFloat(i.rate || 0),
      Rate: parseFloat(i.rate || 0),
      discount: parseFloat(i.discount_percent || 0),
      discountPercent: parseFloat(i.discount_percent || 0),
      discountAmount: parseFloat(i.discount_amount || 0),
      taxable: parseFloat(i.taxable_value || 0),
      taxableValue: parseFloat(i.taxable_value || 0),
      TaxableValue: parseFloat(i.taxable_value || 0),
      gst: parseFloat(i.gst_percent || 0),
      gstPercent: parseFloat(i.gst_percent || 0),
      GSTPercent: parseFloat(i.gst_percent || 0),
      cgst: parseFloat(i.cgst_amount || 0),
      cgstAmount: parseFloat(i.cgst_amount || 0),
      CGSTAmount: parseFloat(i.cgst_amount || 0),
      sgst: parseFloat(i.sgst_amount || 0),
      sgstAmount: parseFloat(i.sgst_amount || 0),
      SGSTAmount: parseFloat(i.sgst_amount || 0),
      igst: parseFloat(i.igst_amount || 0),
      igstAmount: parseFloat(i.igst_amount || 0),
      IGSTAmount: parseFloat(i.igst_amount || 0),
      total: parseFloat(i.total_amount || 0),
      totalAmount: parseFloat(i.total_amount || 0),
      TotalAmount: parseFloat(i.total_amount || 0),
    }));

    return {
      success: true,
      data: {
        sale: saleData,
        items: itemsData,
      },
    };
  },

  createSale: async function (payload) {
    const res = await this.fetch("sales", "select=id&order=id.desc&limit=1");
    const nextNum = (res && res[0] ? res[0].id : 0) + 1;
    const saleId = "SAL-" + String(nextNum).padStart(4, "0");
    const invoiceNo = payload.invoiceNo || ("SGD_" + String(nextNum).padStart(4, "0") + "_26-27");

    const rawItems = payload.items || [];
    let computedGross = 0;
    let computedTaxable = 0;
    let computedCgst = 0;
    let computedSgst = 0;
    let computedIgst = 0;
    let computedTotalQty = 0;

    const normalizedItems = rawItems.map((it) => {
      const itemId = it.itemId || it.ItemID || it.id || null;
      const itemName = it.itemName || it.ItemName || it.name || "Item";
      const hsn = it.hsn || it.hsnCode || it.HSNCode || "";
      const qty = parseFloat(it.quantity !== undefined ? it.quantity : (it.Quantity !== undefined ? it.Quantity : (it.qty || 1)));
      const unit = it.unit || it.Unit || "PCS";
      const rate = parseFloat(it.rate !== undefined ? it.rate : (it.Rate !== undefined ? it.Rate : (it.sellingPrice || it.price || 0)));
      const discPct = parseFloat(it.discountPercent !== undefined ? it.discountPercent : (it.DiscountPercent !== undefined ? it.DiscountPercent : (it.discount || it.disc || 0)));
      const gstPct = parseFloat(it.gstPercent !== undefined ? it.gstPercent : (it.GSTPercent !== undefined ? it.GSTPercent : (it.gst || 18)));

      const baseVal = qty * rate;
      const discVal = baseVal * (discPct / 100);
      const taxableVal = parseFloat((it.taxableValue || it.taxableAmount || (baseVal - discVal)).toFixed(2));
      const cgstVal = parseFloat((it.cgstAmount || it.cgst || (taxableVal * (gstPct / 2 / 100))).toFixed(2));
      const sgstVal = parseFloat((it.sgstAmount || it.sgst || (taxableVal * (gstPct / 2 / 100))).toFixed(2));
      const igstVal = parseFloat((it.igstAmount || it.igst || 0).toFixed(2));
      const rowTotal = parseFloat((it.totalAmount || it.total || (taxableVal + cgstVal + sgstVal + igstVal)).toFixed(2));

      computedGross += baseVal;
      computedTaxable += taxableVal;
      computedCgst += cgstVal;
      computedSgst += sgstVal;
      computedIgst += igstVal;
      computedTotalQty += qty;

      return {
        sale_id: saleId,
        invoice_no: invoiceNo,
        item_id: itemId,
        item_name: itemName,
        hsn_code: hsn,
        quantity: qty,
        unit: unit,
        rate: rate,
        discount_percent: discPct,
        discount_amount: parseFloat(discVal.toFixed(2)),
        taxable_value: taxableVal,
        gst_percent: gstPct,
        cgst_amount: cgstVal,
        sgst_amount: sgstVal,
        igst_amount: igstVal,
        total_amount: rowTotal,
        created_at: new Date().toISOString(),
      };
    });

    const computedTax = computedCgst + computedSgst + computedIgst;
    const computedGrand = Math.round(computedTaxable + computedTax);

    const totalAmt = parseFloat(payload.totalAmount || payload.grandTotal || computedGrand || 0);
    const paidAmt = parseFloat(payload.amountPaid || 0);
    const balDue = totalAmt - paidAmt;
    let payStatus = "Unpaid";
    if (paidAmt >= totalAmt && totalAmt > 0) payStatus = "Paid";
    else if (paidAmt > 0) payStatus = "Partial";

    const saleRecord = {
      sale_id: saleId,
      invoice_no: invoiceNo,
      invoice_date: this.toISODate(payload.invoiceDate || payload.date) || this.currentISODate(),
      due_date: this.toISODate(payload.dueDate) || null,
      party_id: payload.partyId || payload.customerId || null,
      party_name: payload.partyName || payload.customerName || "Cash Customer",
      party_gstin: String(payload.partyGstin || payload.partyGSTIN || "").slice(0, 20),
      party_phone: String(payload.partyPhone || "").slice(0, 20),
      party_address: payload.partyAddress || "",
      state_code: this.extractStateCode(payload.stateCode || payload.partyStateCode, payload.partyGstin || payload.partyGSTIN),
      vehicle_no: String(payload.vehicleNo || payload.transportVehicleNo || "").slice(0, 20),
      total_qty: parseFloat(payload.totalQty || computedTotalQty || 0),
      sub_total: parseFloat(payload.taxableAmount || payload.subTotal || computedTaxable || 0),
      discount_amount: parseFloat(payload.discountAmount || (computedGross - computedTaxable) || 0),
      cgst_amount: parseFloat(payload.cgst || payload.cgstAmount || computedCgst || 0),
      sgst_amount: parseFloat(payload.sgst || payload.sgstAmount || computedSgst || 0),
      igst_amount: parseFloat(payload.igst || payload.igstAmount || computedIgst || 0),
      tax_amount: parseFloat(payload.taxAmount || computedTax || 0),
      round_off: parseFloat(payload.roundOff || 0),
      total_amount: totalAmt,
      amount_paid: paidAmt,
      balance_due: balDue,
      payment_status: String(payStatus).slice(0, 20),
      payment_mode: String(payload.paymentMode || "Cash").slice(0, 20),
      status: "Active",
      created_by: String(SGD.currentUser ? (SGD.currentUser.username || SGD.currentUser.Username) : "system").slice(0, 50),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Insert Sales Header
    await this.fetch("sales", "", {
      method: "POST",
      body: JSON.stringify(saleRecord),
    });

    // 2. Insert Sale Items and Deduct Inventory Stock
    if (normalizedItems.length > 0) {
      await this.fetch("sale_items", "", {
        method: "POST",
        body: JSON.stringify(normalizedItems),
      });

      // Stock reduction for each item
      for (const it of normalizedItems) {
        if (it.item_id) {
          const qty = it.quantity || 0;
          const currentItem = await this.fetch("items", `item_id=eq.${encodeURIComponent(it.item_id)}&select=current_stock`);
          if (currentItem && currentItem[0]) {
            const newStock = Math.max(0, parseFloat(currentItem[0].current_stock || 0) - qty);
            await this.fetch(`items?item_id=eq.${encodeURIComponent(it.item_id)}`, "", {
              method: "PATCH",
              body: JSON.stringify({ current_stock: newStock, updated_at: new Date().toISOString() }),
            });
          }
        }
      }
    }

    // 3. Update Party Ledger & Balance
    if (saleRecord.party_id) {
      const ledgerEntry = {
        entry_id: "LED-" + Date.now(),
        entry_date: saleRecord.invoice_date,
        party_id: saleRecord.party_id,
        party_name: saleRecord.party_name,
        voucher_type: "Sale",
        voucher_no: invoiceNo,
        debit: totalAmt,
        credit: paidAmt,
        balance: balDue,
        narration: `Tax Invoice ${invoiceNo}`,
        created_at: new Date().toISOString(),
      };
      await this.fetch("ledger", "", {
        method: "POST",
        body: JSON.stringify(ledgerEntry),
      });

      // Update party current balance
      const party = await this.fetch("parties", `party_id=eq.${encodeURIComponent(saleRecord.party_id)}&select=current_balance`);
      if (party && party[0]) {
        const curBal = parseFloat(party[0].current_balance || 0) + balDue;
        await this.fetch(`parties?party_id=eq.${encodeURIComponent(saleRecord.party_id)}`, "", {
          method: "PATCH",
          body: JSON.stringify({ current_balance: curBal, updated_at: new Date().toISOString() }),
        });
      }
    }

    return {
      success: true,
      message: "Invoice created successfully",
      data: { saleId, invoiceNo },
    };
  },

  cancelSale: async function (payload) {
    const saleId = payload.saleId || payload.id;
    await this.fetch(`sales?sale_id=eq.${encodeURIComponent(saleId)}`, "", {
      method: "PATCH",
      body: JSON.stringify({ status: "Cancelled", payment_status: "Cancelled", updated_at: new Date().toISOString() }),
    });
    return { success: true, message: "Sale cancelled successfully" };
  },

  /**
   * PURCHASES
   */
  getPurchases: async function () {
    const rows = await this.fetch("purchases", "order=created_at.desc&select=*");
    const data = rows.map((p) => ({
      id: p.purchase_id,
      purchaseId: p.purchase_id,
      PurchaseID: p.purchase_id,
      billNo: p.bill_no,
      BillNo: p.bill_no,
      date: p.bill_date,
      BillDate: p.bill_date,
      partyId: p.party_id,
      PartyID: p.party_id,
      supplier: p.party_name,
      supplierName: p.party_name,
      SupplierName: p.party_name,
      PartyName: p.party_name,
      subTotal: parseFloat(p.sub_total || 0),
      TaxableAmount: parseFloat(p.sub_total || 0),
      cgst: parseFloat(p.cgst_amount || 0),
      sgst: parseFloat(p.sgst_amount || 0),
      igst: parseFloat(p.igst_amount || 0),
      taxAmount: parseFloat(p.tax_amount || 0),
      total: parseFloat(p.total_amount || 0),
      totalAmount: parseFloat(p.total_amount || 0),
      TotalAmount: parseFloat(p.total_amount || 0),
      paid: parseFloat(p.amount_paid || 0),
      amountPaid: parseFloat(p.amount_paid || 0),
      AmountPaid: parseFloat(p.amount_paid || 0),
      balance: parseFloat(p.balance_due || 0),
      status: p.payment_status || "Unpaid",
      PaymentStatus: p.payment_status || "Unpaid",
      Status: p.status || "Active",
    }));
    return { success: true, data };
  },

  createPurchase: async function (payload) {
    const res = await this.fetch("purchases", "select=id&order=id.desc&limit=1");
    const nextNum = (res && res[0] ? res[0].id : 0) + 1;
    const purchaseId = "PUR-" + String(nextNum).padStart(4, "0");
    const billNo = payload.billNo || ("PBILL-" + nextNum);

    const rawItems = payload.items || [];
    let computedGross = 0;
    let computedTaxable = 0;
    let computedTax = 0;
    let computedTotalQty = 0;

    const normalizedItems = rawItems.map((it) => {
      const itemId = it.itemId || it.ItemID || it.id || null;
      const itemName = it.itemName || it.ItemName || it.name || "Item";
      const hsn = it.hsn || it.hsnCode || it.HSNCode || "";
      const qty = parseFloat(it.quantity !== undefined ? it.quantity : (it.Quantity !== undefined ? it.Quantity : (it.qty || 1)));
      const unit = it.unit || it.Unit || "PCS";
      const rate = parseFloat(it.rate !== undefined ? it.rate : (it.Rate !== undefined ? it.Rate : (it.costPrice || it.price || 0)));
      const gstPct = parseFloat(it.gstPercent !== undefined ? it.gstPercent : (it.GSTPercent !== undefined ? it.GSTPercent : (it.gst || 18)));

      const baseVal = qty * rate;
      const taxVal = parseFloat((baseVal * (gstPct / 100)).toFixed(2));
      const rowTotal = parseFloat((baseVal + taxVal).toFixed(2));

      computedGross += baseVal;
      computedTaxable += baseVal;
      computedTax += taxVal;
      computedTotalQty += qty;

      return {
        purchase_id: purchaseId,
        bill_no: billNo,
        item_id: itemId,
        item_name: itemName,
        hsn_code: hsn,
        quantity: qty,
        unit: unit,
        cost_price: rate,
        taxable_value: baseVal,
        gst_percent: gstPct,
        cgst_amount: parseFloat((taxVal / 2).toFixed(2)),
        sgst_amount: parseFloat((taxVal / 2).toFixed(2)),
        igst_amount: 0,
        total_amount: rowTotal,
        created_at: new Date().toISOString(),
      };
    });

    const computedGrand = Math.round(computedTaxable + computedTax);
    const totalAmt = parseFloat(payload.totalAmount || payload.grandTotal || payload.total || computedGrand || 0);
    const paidAmt = parseFloat(payload.amountPaid || payload.paid || 0);
    const balDue = totalAmt - paidAmt;
    let payStatus = "Unpaid";
    if (paidAmt >= totalAmt && totalAmt > 0) payStatus = "Paid";
    else if (paidAmt > 0) payStatus = "Partial";

    const purRecord = {
      purchase_id: purchaseId,
      bill_no: billNo,
      bill_date: this.toISODate(payload.billDate || payload.date) || this.currentISODate(),
      party_id: payload.partyId || payload.supplierId || null,
      party_name: payload.partyName || payload.supplierName || payload.supplier || "Cash Supplier",
      party_gstin: payload.partyGstin || "",
      sub_total: parseFloat(payload.taxableAmount || payload.subTotal || computedTaxable || 0),
      cgst_amount: parseFloat(payload.cgst || (computedTax / 2) || 0),
      sgst_amount: parseFloat(payload.sgst || (computedTax / 2) || 0),
      igst_amount: parseFloat(payload.igst || 0),
      tax_amount: parseFloat(payload.taxAmount || computedTax || 0),
      total_amount: totalAmt,
      amount_paid: paidAmt,
      balance_due: balDue,
      payment_status: payStatus,
      payment_mode: payload.paymentMode || "Bank Transfer",
      status: "Active",
      created_by: SGD.currentUser ? (SGD.currentUser.username || SGD.currentUser.Username) : "system",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.fetch("purchases", "", {
      method: "POST",
      body: JSON.stringify(purRecord),
    });

    // Add Purchase Items & Increase Inventory Stock
    if (normalizedItems.length > 0) {
      await this.fetch("purchase_items", "", {
        method: "POST",
        body: JSON.stringify(normalizedItems),
      });

      // Stock increase for each item
      for (const it of normalizedItems) {
        if (it.item_id) {
          const qty = it.quantity || 0;
          const currentItem = await this.fetch("items", `item_id=eq.${encodeURIComponent(it.item_id)}&select=current_stock`);
          if (currentItem && currentItem[0]) {
            const newStock = parseFloat(currentItem[0].current_stock || 0) + qty;
            await this.fetch(`items?item_id=eq.${encodeURIComponent(it.item_id)}`, "", {
              method: "PATCH",
              body: JSON.stringify({ current_stock: newStock, updated_at: new Date().toISOString() }),
            });
          }
        }
      }
    }

    // 3. Update Supplier Ledger & Balance
    if (purRecord.party_id) {
      try {
        const ledgerEntry = {
          entry_id: "LED-" + Date.now(),
          entry_date: purRecord.bill_date,
          party_id: purRecord.party_id,
          party_name: purRecord.party_name,
          voucher_type: "Purchase",
          voucher_no: billNo,
          debit: paidAmt,
          credit: totalAmt,
          balance: balDue,
          narration: `Purchase Bill ${billNo}`,
          created_at: new Date().toISOString(),
        };
        await this.fetch("ledger", "", {
          method: "POST",
          body: JSON.stringify(ledgerEntry),
        });

        // Update supplier current balance
        const party = await this.fetch("parties", `party_id=eq.${encodeURIComponent(purRecord.party_id)}&select=current_balance`);
        if (party && party[0]) {
          const curBal = parseFloat(party[0].current_balance || 0) + balDue;
          await this.fetch(`parties?party_id=eq.${encodeURIComponent(purRecord.party_id)}`, "", {
            method: "PATCH",
            body: JSON.stringify({ current_balance: curBal, updated_at: new Date().toISOString() }),
          });
        }
      } catch (e) {
        console.warn("Supplier ledger entry warning:", e);
      }
    }

    return {
      success: true,
      message: "Purchase recorded successfully",
      data: { purchaseId, billNo },
    };
  },

  getPurchaseDetails: async function (payload) {
    const purchaseId = payload.purchaseId || payload.id;
    const [purchases, items] = await Promise.all([
      this.fetch("purchases", `purchase_id=eq.${encodeURIComponent(purchaseId)}&select=*`),
      this.fetch("purchase_items", `purchase_id=eq.${encodeURIComponent(purchaseId)}&select=*`),
    ]);

    if (!purchases || purchases.length === 0) {
      return { success: false, message: "Purchase not found" };
    }

    const p = purchases[0];
    const purchaseData = {
      id: p.purchase_id,
      purchaseId: p.purchase_id,
      PurchaseID: p.purchase_id,
      billNo: p.bill_no,
      BillNo: p.bill_no,
      date: p.bill_date,
      BillDate: p.bill_date,
      Date: p.bill_date,
      billDate: p.bill_date,
      supplier: p.party_name,
      supplierName: p.party_name,
      SupplierName: p.party_name,
      partyName: p.party_name,
      PartyName: p.party_name,
      partyGstin: p.party_gstin,
      subTotal: parseFloat(p.sub_total || 0),
      SubTotal: parseFloat(p.sub_total || 0),
      taxAmount: parseFloat(p.tax_amount || 0),
      TaxAmount: parseFloat(p.tax_amount || 0),
      cgst: parseFloat(p.cgst_amount || 0),
      sgst: parseFloat(p.sgst_amount || 0),
      igst: parseFloat(p.igst_amount || 0),
      total: parseFloat(p.total_amount || 0),
      totalAmount: parseFloat(p.total_amount || 0),
      TotalAmount: parseFloat(p.total_amount || 0),
      grandTotal: parseFloat(p.total_amount || 0),
      paid: parseFloat(p.amount_paid || 0),
      amountPaid: parseFloat(p.amount_paid || 0),
      AmountPaid: parseFloat(p.amount_paid || 0),
      balance: parseFloat(p.balance_due || 0),
      balanceDue: parseFloat(p.balance_due || 0),
      BalanceDue: parseFloat(p.balance_due || 0),
      status: p.payment_status || "Unpaid",
      paymentStatus: p.payment_status || "Unpaid",
      PaymentStatus: p.payment_status || "Unpaid",
      Status: p.status || "Active",
    };

    const itemsData = (items || []).map((it) => ({
      itemId: it.item_id,
      id: it.item_id,
      name: it.item_name,
      itemName: it.item_name,
      ItemName: it.item_name,
      hsn: it.hsn_code,
      hsnCode: it.hsn_code,
      HSNCode: it.hsn_code,
      qty: parseFloat(it.quantity || 0),
      quantity: parseFloat(it.quantity || 0),
      Quantity: parseFloat(it.quantity || 0),
      unit: it.unit || "PCS",
      Unit: it.unit || "PCS",
      rate: parseFloat(it.cost_price || it.rate || 0),
      Rate: parseFloat(it.cost_price || it.rate || 0),
      costPrice: parseFloat(it.cost_price || 0),
      taxable: parseFloat(it.taxable_value || 0),
      taxableValue: parseFloat(it.taxable_value || 0),
      gst: parseFloat(it.gst_percent || 0),
      gstPercent: parseFloat(it.gst_percent || 0),
      total: parseFloat(it.total_amount || 0),
      totalAmount: parseFloat(it.total_amount || 0),
      TotalAmount: parseFloat(it.total_amount || 0),
    }));

    return {
      success: true,
      data: {
        purchase: purchaseData,
        items: itemsData,
      },
    };
  },

  cancelPurchase: async function (payload) {
    const purchaseId = payload.purchaseId || payload.id;
    await this.fetch(`purchases?purchase_id=eq.${encodeURIComponent(purchaseId)}`, "", {
      method: "PATCH",
      body: JSON.stringify({ status: "Cancelled", payment_status: "Cancelled", updated_at: new Date().toISOString() }),
    });
    return { success: true, message: "Purchase cancelled" };
  },

  /**
   * REPORTS DATA
   */
  getReportData: async function (payload = {}) {
    const [sales, purchases, items, parties, ledger] = await Promise.all([
      this.fetch("sales", "status=eq.Active&select=*"),
      this.fetch("purchases", "status=eq.Active&select=*"),
      this.fetch("items", "select=*"),
      this.fetch("parties", "select=*"),
      this.fetch("ledger", "order=created_at.desc&select=*"),
    ]);

    const mappedSales = sales.map((s) => ({
      InvoiceNo: s.invoice_no,
      InvoiceDate: s.invoice_date,
      PartyName: s.party_name,
      TaxableAmount: parseFloat(s.sub_total || 0),
      DiscountAmount: parseFloat(s.discount_amount || 0),
      CGSTAmount: parseFloat(s.cgst_amount || 0),
      SGSTAmount: parseFloat(s.sgst_amount || 0),
      IGSTAmount: parseFloat(s.igst_amount || 0),
      TaxAmount: parseFloat(s.tax_amount || 0),
      TotalAmount: parseFloat(s.total_amount || 0),
      AmountPaid: parseFloat(s.amount_paid || 0),
      PaymentStatus: s.payment_status,
      Status: s.status,
    }));

    const mappedPurchases = purchases.map((p) => ({
      BillNo: p.bill_no,
      BillDate: p.bill_date,
      PartyName: p.party_name,
      TaxableAmount: parseFloat(p.sub_total || 0),
      CGSTAmount: parseFloat(p.cgst_amount || 0),
      SGSTAmount: parseFloat(p.sgst_amount || 0),
      IGSTAmount: parseFloat(p.igst_amount || 0),
      TaxAmount: parseFloat(p.tax_amount || 0),
      TotalAmount: parseFloat(p.total_amount || 0),
      AmountPaid: parseFloat(p.amount_paid || 0),
      PaymentStatus: p.payment_status,
      Status: p.status,
    }));

    const mappedItems = items.map((i) => ({
      ItemID: i.item_id,
      ItemName: i.item_name,
      Category: i.category,
      CurrentStock: parseFloat(i.current_stock || 0),
      MinStock: parseFloat(i.min_stock || 0),
      Unit: i.unit,
      PurchasePrice: parseFloat(i.purchase_price || 0),
      SellingPrice: parseFloat(i.selling_price || 0),
      Status: i.status,
    }));

    const mappedParties = parties.map((p) => ({
      PartyID: p.party_id,
      PartyName: p.party_name,
      PartyType: p.party_type,
      GSTIN: p.gstin,
      Phone: p.phone,
      City: p.city,
      CurrentBalance: parseFloat(p.current_balance || 0),
      BalanceType: p.balance_type,
      Status: p.status,
    }));

    const mappedLedger = ledger.map((l) => ({
      EntryID: l.entry_id,
      Date: l.entry_date,
      PartyID: l.party_id,
      PartyName: l.party_name,
      VoucherType: l.voucher_type,
      VoucherNo: l.voucher_no,
      Debit: parseFloat(l.debit || 0),
      Credit: parseFloat(l.credit || 0),
      Balance: parseFloat(l.balance || 0),
      Narration: l.narration,
    }));

    return {
      success: true,
      data: {
        sales: mappedSales,
        purchases: mappedPurchases,
        items: mappedItems,
        parties: mappedParties,
        ledger: mappedLedger,
      },
    };
  },

  /**
   * USERS MANAGEMENT
   */
  getUsers: async function () {
    const rows = await this.fetch("users", "order=created_at.desc&select=*");
    const data = rows.map((u) => ({
      id: u.id,
      userId: u.user_id,
      UserID: u.user_id,
      fullName: u.full_name,
      FullName: u.full_name,
      username: u.username,
      Username: u.username,
      role: u.role,
      Role: u.role,
      permissions: typeof u.permissions === "string" ? JSON.parse(u.permissions) : u.permissions,
      Permissions: typeof u.permissions === "string" ? JSON.parse(u.permissions) : u.permissions,
      status: u.status,
      Status: u.status,
    }));
    return { success: true, data };
  },

  createUser: async function (payload) {
    const res = await this.fetch("users", "select=id&order=id.desc&limit=1");
    const nextNum = (res && res[0] ? res[0].id : 0) + 1;
    const userId = "USR-" + String(nextNum).padStart(3, "0");

    const record = {
      user_id: userId,
      full_name: payload.fullName || payload.FullName,
      username: payload.username || payload.Username,
      password_hash: payload.password || payload.password_hash || "user123",
      role: payload.role || payload.Role || "staff",
      permissions: payload.permissions || payload.Permissions || {},
      status: payload.status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.fetch("users", "", {
      method: "POST",
      body: JSON.stringify(record),
    });

    return { success: true, message: "User created successfully", data: { userId } };
  },

  updateUser: async function (payload) {
    const userId = payload.userId || payload.UserID;
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (payload.fullName || payload.FullName) updateData.full_name = payload.fullName || payload.FullName;
    if (payload.role || payload.Role) updateData.role = payload.role || payload.Role;
    if (payload.permissions || payload.Permissions) updateData.permissions = payload.permissions || payload.Permissions;
    if (payload.status || payload.Status) updateData.status = payload.status || payload.Status;
    if (payload.password) updateData.password_hash = payload.password;

    await this.fetch(`users?user_id=eq.${encodeURIComponent(userId)}`, "", {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    return { success: true, message: "User updated successfully" };
  },

  deleteUser: async function (payload) {
    const userId = payload.userId || payload.UserID;
    await this.fetch(`users?user_id=eq.${encodeURIComponent(userId)}`, "", {
      method: "PATCH",
      body: JSON.stringify({ status: "inactive", updated_at: new Date().toISOString() }),
    });
    return { success: true, message: "User deactivated successfully" };
  },

  adminResetPassword: async function (payload) {
    const userId = payload.userId || payload.UserID;
    await this.fetch(`users?user_id=eq.${encodeURIComponent(userId)}`, "", {
      method: "PATCH",
      body: JSON.stringify({ password_hash: payload.newPassword, updated_at: new Date().toISOString() }),
    });
    return { success: true, message: "Password reset successfully" };
  },
};

if (typeof window !== "undefined") {
  window.SupabaseAPI = SupabaseAPI;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SupabaseAPI;
}
