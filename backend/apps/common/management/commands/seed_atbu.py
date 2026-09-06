"""
Seed the real ATBU academic structure: Faculties -> Departments -> Programmes.

Data sourced from the official ATBU website (faculties page) and the
documented programme list (see atbu-university.md at repo root).

Idempotent: uses get_or_create on (tenant, code) for every level, so it can be
re-run safely. Existing placeholder rows (e.g. FOC / Faculty of Computing) are
left untouched.
"""
from django.core.management.base import BaseCommand

from apps.academics.models import Department, Faculty, Programme
from apps.tenants.models import Tenant

TENANT_SLUG = "ATBU"


def prog(code, name, degree_type, duration_years=4):
    return {
        "code": code,
        "name": name,
        "degree_type": degree_type,
        "duration_years": duration_years,
    }


def dept(code, name, programmes):
    return {"code": code, "name": name, "programmes": programmes}


FACULTIES = [
    {
        "code": "FAAT",
        "name": "Faculty of Agriculture and Agricultural Technology",
        "departments": [
            dept("ANP", "Department of Animal Production", [
                prog("ANIMAL-PROD", "Animal Production", "BAgric"),
            ]),
            dept("CRP", "Department of Crop Production", [
                prog("CROP-PROD", "Crop Production", "BAgric"),
            ]),
            dept("SOS", "Department of Soil Science", []),
            dept("ECO", "Department of Ecology", []),
            dept("AEE", "Department of Agricultural Economics and Extension", [
                prog("AGRIC-ECON", "Agricultural Economics and Extension", "BAgric"),
                prog("AGRIC", "Agriculture", "BAgric"),
            ]),
        ],
    },
    {
        "code": "FEET",
        "name": "Faculty of Engineering and Engineering Technology",
        "departments": [
            dept("ABE", "Department of Agriculture and Bio-Resource Engineering", [
                prog("AGRIC-ENG", "Agricultural Engineering", "BEng", 5),
            ]),
            dept("AUE", "Department of Automobile Engineering", [
                prog("AUTO-ENG", "Automobile Engineering", "BEng", 5),
            ]),
            dept("CHE", "Department of Chemical Engineering", [
                prog("CHEM-ENG", "Chemical Engineering", "BEng", 5),
            ]),
            dept("CVE", "Department of Civil Engineering", [
                prog("CIVIL-ENG", "Civil Engineering", "BEng", 5),
            ]),
            dept("CCE", "Department of Computer and Communication Engineering", [
                prog("COMPCOM-ENG", "Computer and Communication Engineering", "BEng", 5),
            ]),
            dept("EEE", "Department of Electrical/Electronics Engineering", [
                prog("ELEC-ENG", "Electrical/Electronics Engineering", "BEng", 5),
            ]),
            dept("MPE", "Department of Mechanical/Production Engineering", [
                prog("MECH-ENG", "Mechanical/Production Engineering", "BEng", 5),
            ]),
            dept("MSE", "Department of Mechatronics and Systems Engineering", [
                prog("MECHT-ENG", "Mechatronics and Systems Engineering", "BEng", 5),
            ]),
            dept("PTE", "Department of Petroleum Engineering", [
                prog("PET-ENG", "Petroleum Engineering", "BEng", 5),
            ]),
        ],
    },
    {
        "code": "FET",
        "name": "Faculty of Environmental Technology",
        "departments": [
            dept("ARC", "Department of Architecture", [
                prog("ARCH", "Architecture", "BSc", 5),
            ]),
            dept("BLD", "Department of Building", [
                prog("BUILDING", "Building Technology", "BSc"),
            ]),
            dept("EMT", "Department of Environmental Management Technology", [
                prog("ENV-MGT", "Environmental Management Technology", "BSc"),
            ]),
            dept("EMV", "Department of Estate Management and Valuation", [
                prog("ESTATE-MGT", "Estate Management", "BSc"),
            ]),
            dept("IND", "Department of Industrial Design", [
                prog("IND-DESIGN", "Industrial Design", "BSc"),
            ]),
            dept("QSV", "Department of Quantity Survey", [
                prog("QUANT-SURV", "Quantity Surveying", "BSc"),
            ]),
            dept("SGN", "Department of Survey and Geo-Informatics", [
                prog("SURV-GEO", "Surveying and Geoinformatics", "BSc"),
            ]),
            dept("URP", "Department of Urban and Regional Planning", [
                prog("URBAN-PLAN", "Urban and Regional Planning", "BSc"),
            ]),
        ],
    },
    {
        "code": "FMT",
        "name": "Faculty of Management Technology",
        "departments": [
            dept("ACC", "Department of Accounting and Finance", [
                prog("ACCOUNTING", "Accounting", "BTech"),
            ]),
            dept("MIT", "Department of Management and Information Technology", [
                prog("MGT-TECH", "Management Technology", "BTech"),
                prog("INFO-TECH", "Information Technology", "BTech"),
            ]),
            dept("BFT", "Department of Banking and Finance Technology", [
                prog("BANKING-FIN", "Banking and Finance", "BTech"),
            ]),
            dept("BMT", "Department of Business Management", [
                prog("BUSINESS-MGT", "Business Management", "BTech"),
            ]),
            dept("TNE", "Department of Technopreneurship", [
                prog("TECHNO", "Technopreneurship", "BTech"),
            ]),
        ],
    },
    {
        "code": "FOT",
        "name": "Faculty of Technology Education",
        "departments": [
            dept("FND", "Department of Foundation Courses", []),
            dept("SCE", "Department of Science Education", [
                prog("EDU-BIO", "Education and Biology", "BSc(Ed)"),
                prog("EDU-CHEM", "Education and Chemistry", "BSc(Ed)"),
                prog("EDU-CS", "Education and Computer Science", "BSc(Ed)"),
                prog("EDU-ISCI", "Education and Integrated Science", "BSc(Ed)"),
                prog("EDU-MATH", "Education and Mathematics", "BSc(Ed)"),
                prog("EDU-PHY", "Education and Physics", "BSc(Ed)"),
            ]),
            dept("VTE", "Department of Vocational and Technology Education", [
                prog("AGRI-SCI-ED", "Agricultural Science and Education", "BSc(Ed)"),
                prog("AUTO-TECH-ED", "Automobile Technology Education", "BEd"),
                prog("BUILDING-ED", "Building Education", "BEd"),
                prog("BUSINESS-ED", "Business Education", "BEd"),
                prog("ELEC-ED", "Electrical/Electronics Education", "BEd"),
                prog("METAL-ED", "Metalwork Technology Education", "BEd"),
                prog("SECRETARIAL-ED", "Secretarial Education", "BEd"),
                prog("WOOD-ED", "Woodwork Technology Education", "BEd"),
            ]),
            dept("LIS", "Department of Library and Information Science", [
                prog("LIS", "Library and Information Science", "BLIS"),
            ]),
        ],
    },
    {
        "code": "FOS",
        "name": "Faculty of Science",
        "departments": [
            dept("MAT", "Department of Mathematical Sciences", [
                prog("MATH", "Mathematics", "BSc"),
                prog("STAT", "Statistics", "BSc"),
                prog("COMP-SCI", "Computer Science", "BSc"),
            ]),
            dept("BIO", "Department of Biological Sciences", [
                prog("APPL-BOT", "Applied Botany", "BSc"),
                prog("APPL-ZOO", "Applied Zoology", "BSc"),
                prog("APPL-ECO", "Applied Ecology", "BSc"),
            ]),
            dept("CHY", "Department of Chemistry", [
                prog("CHEM", "Chemistry", "BSc"),
                prog("IND-CHEM", "Industrial Chemistry", "BSc"),
            ]),
            dept("GLY", "Department of Geology", [
                prog("APPL-GEO", "Applied Geology", "BSc"),
                prog("GEOPHYS", "Geophysics", "BSc"),
            ]),
            dept("PHY", "Department of Physics", [
                prog("PHY-APPL-PHY", "Physics and Applied Physics", "BSc"),
            ]),
            dept("BCH", "Department of Biochemistry", [
                prog("BCH", "Biochemistry", "BSc"),
            ]),
            dept("MCB", "Department of Microbiology", [
                prog("MCB", "Microbiology", "BSc"),
            ]),
        ],
    },
    {
        "code": "COMS",
        "name": "College of Medical Sciences",
        "departments": [
            dept("CMS", "College of Medical Sciences", [
                prog("MED-SURG", "Medicine and Surgery", "MBBS", 6),
            ]),
        ],
    },
]


class Command(BaseCommand):
    help = (
        "Seed the real ATBU academic structure "
        "(Faculties -> Departments -> Programmes). Idempotent."
    )

    def handle(self, *args, **options):
        tenant, created = Tenant.objects.get_or_create(
            slug=TENANT_SLUG,
            defaults={"name": "Abubakar Tafawa Balewa University"},
        )
        self.stdout.write(f"Tenant: {tenant.slug} ({'created' if created else 'exists'})")

        for fac in FACULTIES:
            faculty, fac_created = Faculty.objects.get_or_create(
                tenant=tenant,
                code=fac["code"],
                defaults={"name": fac["name"]},
            )
            if not fac_created and faculty.name != fac["name"]:
                faculty.name = fac["name"]
                faculty.save()

            for dep in fac["departments"]:
                department, dep_created = Department.objects.get_or_create(
                    tenant=tenant,
                    code=dep["code"],
                    defaults={
                        "faculty": faculty,
                        "name": dep["name"],
                    },
                )
                if not dep_created and department.faculty_id != faculty.pk:
                    department.faculty = faculty
                    department.save()

                for p in dep["programmes"]:
                    programme, prog_created = Programme.objects.get_or_create(
                        tenant=tenant,
                        code=p["code"],
                        defaults={
                            "department": department,
                            "name": p["name"],
                            "degree_type": p["degree_type"],
                            "duration_years": p["duration_years"],
                        },
                    )
                    if not prog_created and (
                        programme.department_id != department.pk
                        or programme.name != p["name"]
                        or programme.degree_type != p["degree_type"]
                    ):
                        programme.department = department
                        programme.name = p["name"]
                        programme.degree_type = p["degree_type"]
                        programme.duration_years = p["duration_years"]
                        programme.save()

                self.stdout.write(
                    f"  {dep['code']} — {dep['name']} "
                    f"({len(dep['programmes'])} programmes)"
                )

        total_f = Faculty.objects.filter(tenant=tenant).count()
        total_d = Department.objects.filter(tenant=tenant).count()
        total_p = Programme.objects.filter(tenant=tenant).count()
        self.stdout.write(self.style.SUCCESS(
            f"Done. ATBU totals — faculties: {total_f}, departments: {total_d}, "
            f"programmes: {total_p}"
        ))