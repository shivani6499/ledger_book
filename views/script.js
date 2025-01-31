document.addEventListener("DOMContentLoaded", () => {
  fetchDataAndRender();
});

const fetchDataAndRender = async () => {
  try {
    const response = await fetch("http://localhost:3001/api/ledger/all");
    const data = await response.json();

    renderTable(data.data);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};
const renderTable = (data) => {
  const tableBody = document.getElementById("expense-table-body");
  tableBody.innerHTML = "";

  data.forEach((item) => {
    const row = document.createElement("tr");

    const bookCell = document.createElement("td");
    bookCell.textContent = item.book;

    const pageCell = document.createElement("td");
    pageCell.textContent = item.pageNo;

    const totalCreditCell = document.createElement("td");
    totalCreditCell.textContent = item.tableEntries.reduce(
      (sum, entry) => sum + entry.credit || 0,
      0
    );

    const totalDebitCell = document.createElement("td");
    totalDebitCell.textContent = item.tableEntries.reduce(
      (sum, entry) => sum + entry.debit || 0,
      0
    );

    const actionsCell = document.createElement("td");
    actionsCell.innerHTML = `
      <button class="action-btn view-details-btn" data-book="${item.book}" data-page-no="${item.pageNo}">Details</button>
      <button class="action-btn delete-btn" data-book="${item.book}" data-page-no="${item.pageNo}">Delete</button>
    `;

    row.appendChild(bookCell);
    row.appendChild(pageCell);
    row.appendChild(totalCreditCell);
    row.appendChild(totalDebitCell);
    row.appendChild(actionsCell);

    tableBody.appendChild(row);
  });

  document.querySelectorAll(".view-details-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const book = event.target.dataset.book; 
      const pageNo = event.target.dataset.pageNo; 
      viewDetails(book, pageNo); 
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const book = event.target.dataset.book;
      const pageNo = event.target.dataset.pageNo;
      deleteLedgerEntry(book, pageNo);
    });
  });
};


const viewDetails = async (book, pageNo) => {
  try {
    console.log(`Requesting details for book: ${book}, page: ${pageNo}`);
    const response = await fetch(`/api/ledger/${book}/${pageNo}`);
    const data = await response.json();

    if (data.openingBalance !== undefined) {
      document.getElementById("balanceInput").value = data.openingBalance;

      if (data.data.length === 0) {
        if (parseInt(pageNo) === 1) {
          alert(
            "No data found for the first page and book. Starting with zero balances."
          );
          document.getElementById("dateInput").value = ""; 
          document.getElementById("bookInput").value = book; 
          document.getElementById("pageInput").value = pageNo; 
          document.getElementById("debitTotal").textContent = "0.00"; 
          document.getElementById("creditTotal").textContent = "0.00";
          addNewRow(); // Optionally add a new row for user entry
        }
        // else {
        //   alert("No data found for this page and book. You can insert new data.");DFDS
        //   addNewRow(); // Add logic to insert a new row if necessary
        // }
      } else {
        // Populate the table with fetched data
        populateTable(data.data, data.totalDebit, data.totalCredit);

        // Format and set the date input
        const dateFromApi = data.data[0].date;
        const formattedDate = new Date(dateFromApi).toISOString().split("T")[0];
        document.getElementById("dateInput").value = formattedDate;

        // Set the book and page inputs based on fetched data
        document.getElementById("bookInput").value = data.data[0].book;
        document.getElementById("pageInput").value = pageNo;
      }
    } else {
      alert("No opening balance found for this page and book.");
    }
  } catch (error) {
    console.error("Error fetching page details:", error);
    alert("Failed to fetch page details.");
  }
};
const deleteLedgerEntry = async (book, pageNo) => {
  const confirmation = confirm(
    "Are you sure you want to delete this page and its entries?"
  );
  if (confirmation) {
    try {
      // Send a DELETE request to your backend API
      const response = await fetch(
        `http://localhost:3001/api/delete-page/${book}/${pageNo}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        alert("Page and its entries deleted successfully!");

        // Refresh the table after deletion
        fetchDataAndRender();
      } else {
        alert("Failed to delete the page.");
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      alert("Error deleting page.");
    }
  }
};

function populateTable(ledgerData) {
  const tableBody = document.getElementById("ledgerTableBody");
  tableBody.innerHTML = ""; // Clear the table before appending new rows

  let totalDebit = 0;
  let totalCredit = 0;

  ledgerData.forEach((ledger) => {
    ledger.tableEntries.forEach((entry) => {
      const existingRow = document.getElementById(`entry-${entry.id}`);
      if (!existingRow) {
        // Only add the row if it doesn't already exist
        const row = createRow(entry);
        row.id = `entry-${entry.id}`; // Set unique id for the row
        tableBody.appendChild(row);
      }

      totalDebit += entry.debit || 0; // Adding to total debit
      totalCredit += entry.credit || 0; // Adding to total credit
    });
  });

  updateTotalDisplay(totalDebit, totalCredit);
}

function updateTotalDisplay(totalDebit, totalCredit) {
  const totalDebitElement = document.getElementById("totalDebit");
  const totalCreditElement = document.getElementById("totalCredit");

  if (totalDebitElement && totalCreditElement) {
    totalDebitElement.textContent = totalDebit;
    totalCreditElement.textContent = totalCredit;
  }
}

function createRow(entry) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'particulars', this.innerText)">${entry.particulars || ""}</td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'narration1', this.innerText)">${entry.narration1 || ""}</td>  <!-- Fix Here -->
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'debit', this.innerText)">${entry.debit || 0}</td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'particulars2', this.innerText)">${entry.particulars2 || ""}</td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'narration2', this.innerText)">${entry.narration2 || ""}</td> <!-- Fix Here -->
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'credit', this.innerText)">${entry.credit || 0}</td>
  `;

  return row;
}


// Function to add a new row to the table
function addNewRow() {
  const tbody = document.getElementById("ledgerTableBody");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td contenteditable="true" onkeydown="handleKeyPress(event, this)"></td>
    <td contenteditable="true" onkeydown="handleKeyPress(event, this)"></td>
    <td contenteditable="true" onkeydown="handleKeyPress(event, this)"></td>
    <td contenteditable="true" onkeydown="handleKeyPress(event, this)"></td>
    <td contenteditable="true" onkeydown="handleKeyPress(event, this)"></td>
    <td contenteditable="true" onkeydown="handleKeyPress(event, this)"></td>
    
    
  `;

  tbody.appendChild(row);

  row.querySelector("td").focus();
}

function handleKeyPress(event, cell) {
  if (event.key === "Enter") {
    event.preventDefault();

    const row = cell.closest("tr");
    const nextCell = cell.nextElementSibling;

    if (nextCell) {
      nextCell.focus();
    } else {
      addNewRow();
    }
  }
}
function createRow(entry) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'particulars', this.innerText)">
      ${entry.particulars || ""}
    </td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'narration1', this.innerText)">
      ${entry.narration1 || ""}
    </td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'debit', this.innerText)">
      ${entry.debit || 0}
    </td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'particulars2', this.innerText)">
      ${entry.particulars2 || ""}
    </td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'narration2', this.innerText)">
      ${entry.narration2 || ""}
    </td>
    <td contenteditable="true" onblur="updateEntry(${entry.id}, 'credit', this.innerText)">
      ${entry.credit || 0}
    </td>
  `;

  return row;
}

// Function to update an individual entry
const updateEntry = (entryId, field, newValue) => {
  console.log(entryId,"entryId")
  console.log(field,"field")
  console.log(newValue,"newValue")
  console.log("shivannni")
  // Validate inputs
  // if (!entryId || !field) {
  //   console.error("Invalid entry ID or field to update");
  //   return;
  // }

  fetch(`/api/update-ledger-entry/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, value: newValue }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        console.log("Entry updated successfully");
      } else {
        console.error("Error updating entry:", data.message || "Unknown error");
        alert("Failed to update entry. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating ledger entry:", error);
      alert("An error occurred while updating. Please try again.");
    });
};

// Initialize the ledger table on page load
document.addEventListener("DOMContentLoaded", () => {
  populateLedgerTable(); // Populate the table with initial data
});

function saveLedgerData() {
  const book = document.getElementById("bookInput").value.trim();
  const pageNo = document.getElementById("pageInput").value.trim();
  const balance = document.getElementById("balanceInput").value.trim();
  const date = document.getElementById("dateInput").value.trim();

  const tableEntries = [];
  const rows = document.querySelectorAll("#ledgerTableBody tr");

  rows.forEach((row) => {
    tableEntries.push({
      particulars: row.cells[0].innerText.trim(),
      narration1: row.cells[1].innerText.trim(), // Ensure narration1 is collected
      debit: row.cells[2].innerText.trim() || 0,
      particulars2: row.cells[3].innerText.trim(),
      narration2: row.cells[4].innerText.trim(), // Ensure narration2 is collected
      credit: row.cells[5].innerText.trim() || 0,
    });
  });
  

  const payload = { book, pageNo, balance, date, tableEntries };

  fetch("/api/save-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      Swal.fire(
        data.message === "Ledger data saved successfully!"
          ? { icon: "success", text: "Saved successfully!", timer: 2000 }
          : { icon: "error", text: "Failed to save data.", timer: 2000 }
      ).then(() => {
        if (data.message === "Ledger data saved successfully!") {
          window.location.reload();
        }
      });
    })
    .catch(() => {
      Swal.fire({ icon: "error", text: "An error occurred.", timer: 2000 });
    });
}

document.getElementById("pageInput").addEventListener("change", function () {
  const pageNo = this.value;
  const book = document.getElementById("bookInput").value;

  if (pageNo && book) {
    fetch(`/api/ledger/${book}/${pageNo}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.openingBalance !== undefined) {
          // Set opening balance for the current page
          document.getElementById("balanceInput").value = data.openingBalance;

          if (data.data.length === 0) {
            // Handle no data for the current page
            if (parseInt(pageNo) === 1) {
              alert(
                "No data found for the first page and book. Starting with zero balances."
              );
              document.getElementById("balanceInput").value = "0.00";
              document.getElementById("dateInput").value = ""; // Clear date input
              addNewRow(); // Add a new row for user input
            }
            // else {
            //   alert("No data found for this page and book. You can insert new data.");
            //   addNewRow(); // Add a new row for user input
            // }
          } else {
            // Populate table with data if entries are found
            populateTable(data.data, data.totalDebit, data.totalCredit);

            // Format and set date input
            const dateFromApi = data.data[0].date;
            const formattedDate = new Date(dateFromApi)
              .toISOString()
              .split("T")[0];
            document.getElementById("dateInput").value = formattedDate;
          }
        } else {
          // Handle missing opening balance for the current page
          const previousPageNo = parseInt(pageNo) - 1;
          if (previousPageNo > 0) {
            // Fetch the opening balance of the previous page
            fetch(`/api/ledger/${book}/${previousPageNo}`)
              .then((response) => response.json())
              .then((previousData) => {
                if (previousData.openingBalance !== undefined) {
                  document.getElementById("balanceInput").value =
                    previousData.openingBalance;
                } else {
                  document.getElementById("balanceInput").value = "0.00";
                  alert(
                    "No opening balance found for the previous page. Defaulting to zero."
                  );
                }
              })
              .catch((error) => {
                console.error("Error fetching previous page data:", error);
                alert("Failed to fetch previous page data.");
                document.getElementById("balanceInput").value = "0.00";
              });
          } else {
            // Handle case where there's no previous page
            document.getElementById("balanceInput").value = "0.00";
            alert("No previous page found. Defaulting to zero.");
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching ledger data:", error);
        alert("Failed to fetch ledger data.");
        document.getElementById("balanceInput").value = "0.00";
      });
  } else {
    // Handle invalid page or book input
    document.getElementById("balanceInput").value = "0.00";
    alert("Please select a valid page number and book.");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  addNewRow();
});

document.addEventListener("DOMContentLoaded", () => {
  addNewRow();
});

function fetchLedgerData(pageNo) {
  const book = document.getElementById("bookInput").value; // Get the selected book (e.g., year)

  if (book && pageNo) {
    fetch(`/api/ledger/${book}/${pageNo}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.openingBalance !== undefined) {
          // Set the opening balance from the API response
          document.getElementById("balanceInput").value = data.openingBalance;

          if (data.data.length === 0) {
            // Handle the case when no data exists for the selected page
            if (parseInt(pageNo) === 1) {
              alert(
                "No data found for the first page and book. Starting with zero balances."
              );
              document.getElementById("balanceInput").value = "0.00";
              document.getElementById("dateInput").value = ""; // Clear date input
              addNewRow(); // Add a new row for user input
            } else {
              alert(
                "No entries found for this page and book. You can insert new data."
              );
              addNewRow(); // Add a new row for user input
            }
          } else {
            // Populate the table with the fetched data
            populateTable(data.data, data.totalDebit, data.totalCredit);

            // Format and set the date input
            const dateFromApi = data.data[0].date;
            const formattedDate = new Date(dateFromApi)
              .toISOString()
              .split("T")[0];
            document.getElementById("dateInput").value = formattedDate;
          }
        } else {
          alert("No opening balance found for this page and book.");
        }
      })
      .catch((error) => {
        console.error("Error fetching ledger data:", error);
        alert("Failed to fetch ledger data.");
      });
  } else {
    alert("Please select a valid book and page number.");
  }
}

function populateTable(ledgerData) {
  const tableBody = document.getElementById("ledgerTableBody");
  tableBody.innerHTML = "";

  let totalDebit = 0;
  let totalCredit = 0;

  ledgerData.forEach((ledger) => {
    ledger.tableEntries.forEach((entry) => {
      const row = createRow(entry);
      tableBody.appendChild(row);

      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    });
  });
  updateTotalDisplay(totalDebit, totalCredit);
}

function isRowEmpty(row) {
  const cells = row.querySelectorAll("td");
  return Array.from(cells).every((cell) => {
    const cellText = cell.innerText.trim();
    return cellText === "" || cellText === "0" || cellText === "null";
  });
}

function deleteRow(entryId, row) {
  fetch(`/api/delete-ledger-entry/${entryId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        row.remove();
      } else {
        alert("Error deleting row.");
      }
    })
    .catch((error) => {
      console.error("Error deleting row:", error);
      alert("Error deleting row.");
    });
}

function deleteField(entryId, field) {
  const payload = { field };

  fetch(`/api/delete-ledger-entry-field/${entryId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        console.log("Field deleted successfully");
      } else {
        alert("Error deleting field.");
      }
    })
    .catch((error) => {
      console.error("Error deleting field:", error);
      alert("Error deleting field.");
    });
}
