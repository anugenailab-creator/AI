import pandas as pd
import os

# Ensure the directory exists
os.makedirs("data", exist_ok=True)

# --- Sheet 1: organization_profile ---
organization_profile = pd.DataFrame({
    "field": ["org_name", "org_description", "industry"],
    "value": ["Cummins Inc.", 
              "Global manufacturer of heavy-duty diesel engines", 
              "Manufacturing"]
})

# --- Sheet 2: scope_dimensions ---
scope_dimensions = pd.DataFrame({
    "dimension_type": [
        "Product Line", "Product Line", "Product Line",
        "Plant", "Plant", "Plant",
        "Market", "Market", "Market", "Market"
    ],
    "value": [
        "Heavy-duty diesel engines", "Natural gas engines", "Power generation equipment",
        "North America", "Europe", "Asia Pacific",
        "On-highway", "Off-highway", "Industrial", "Marine"
    ]
})

# --- Sheet 3: tracked_regulations ---
tracked_regulations = pd.DataFrame({
    "id": ["EPA-2023-HDE-001", "ECHA-2023-PFAS-001", "EPA-2022-GHG-001", "ISO-2021-8178"],
    "title": [
        "EPA Heavy-Duty Engine NOx Standards",
        "PFAS Restriction Regulation",
        "Greenhouse Gas Emissions Standards",
        "Engine Emission Test Methods"
    ],
    "identifier": ["40 CFR Part 1036", "REACH Annex XVII", "40 CFR Part 1037", "ISO 8178"],
    "status": ["active", "active", "active", "active"]
})

# --- Save to Excel ---
with pd.ExcelWriter("data/system_db.xlsx", engine="xlsxwriter") as writer:
    organization_profile.to_excel(writer, sheet_name="organization_profile", index=False)
    scope_dimensions.to_excel(writer, sheet_name="scope_dimensions", index=False)
    tracked_regulations.to_excel(writer, sheet_name="tracked_regulations", index=False)

print("✅ Excel file 'data/system_db.xlsx' created successfully!")
