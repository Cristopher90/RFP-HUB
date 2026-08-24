import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  await prisma.answer.deleteMany();
  await prisma.itemPrice.deleteMany();
  await prisma.response.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.rfpQuestion.deleteMany();
  await prisma.rfpItem.deleteMany();
  await prisma.rfp.deleteMany();
  await prisma.templateItem.deleteMany();
  await prisma.templateQuestion.deleteMany();
  await prisma.rfpTemplate.deleteMany();
  await prisma.approvalWorkflow.deleteMany();
  await prisma.user.deleteMany();
  await prisma.commodity.deleteMany();
  await prisma.region.deleteMany();
  await prisma.origin.deleteMany();
  await prisma.supplierDirectory.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        name: "Ana",
        lastName: "Gómez",
        client: "Cliente Demo",
        email: "comprador@baseline.rfp",
        companyCode: "1000",
        plant: "MX01",
        costCenter: "CC-COMPRAS",
        passwordHash: hashPassword("comprador123"),
        role: "BUYER",
      },
      {
        name: "Bruno",
        lastName: "Torres",
        client: "Cliente Demo",
        email: "senior@baseline.rfp",
        companyCode: "1000",
        plant: "MX01",
        costCenter: "CC-COMPRAS",
        passwordHash: hashPassword("senior123"),
        role: "SENIOR_BUYER",
      },
      {
        name: "Carla",
        lastName: "Ruiz",
        client: "Cliente Demo",
        email: "admin@baseline.rfp",
        companyCode: "1000",
        plant: "MX01",
        costCenter: "CC-TI",
        passwordHash: hashPassword("admin123"),
        role: "ADMIN",
      },
    ],
  });
  const [buyerUser, seniorUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: "comprador@baseline.rfp" },
    }),
    prisma.user.findUniqueOrThrow({ where: { email: "senior@baseline.rfp" } }),
  ]);

  const hwCommodity = await prisma.commodity.create({
    data: { code: "HW", description: "Hardware" },
  });
  await prisma.commodity.createMany({
    data: [
      { code: "HW-IT", description: "Hardware / IT", parentId: hwCommodity.id },
      {
        code: "HW-NET",
        description: "Hardware / Redes",
        parentId: hwCommodity.id,
      },
      { code: "SVC-PRO", description: "Servicios profesionales" },
      { code: "MKT", description: "Marketing" },
    ],
  });

  const latamRegion = await prisma.region.create({
    data: { code: "LATAM", description: "LATAM" },
  });
  await prisma.region.createMany({
    data: [
      { code: "LATAM-N", description: "LATAM Norte", parentId: latamRegion.id },
      { code: "LATAM-S", description: "LATAM Sur", parentId: latamRegion.id },
      { code: "EMEA", description: "EMEA" },
    ],
  });

  await prisma.origin.createMany({
    data: [
      { code: "SOL", description: "Solicitud interna" },
      { code: "RENOV", description: "Renovación de contrato" },
      { code: "PROY", description: "Proyecto nuevo" },
    ],
  });

  await prisma.supplierDirectory.createMany({
    data: [
      {
        code: "PROV-001",
        taxId: "B12345678",
        companyName: "TechNova",
        contactFirstName: "Laura",
        contactLastName: "Méndez",
        email: "laura@technova.com",
        phone: "+34 600 111 222",
        status: "ACTIVE",
      },
      {
        code: "PROV-002",
        taxId: "B87654321",
        companyName: "Computel",
        contactFirstName: "Carlos",
        contactLastName: "Ibarra",
        email: "carlos@computel.mx",
        phone: "+52 55 1234 5678",
        status: "ACTIVE",
      },
      {
        code: "PROV-003",
        taxId: "B11223344",
        companyName: "DigitalPro",
        contactFirstName: "Sofía",
        contactLastName: "Ramírez",
        email: "sofia@digitalpro.com",
        phone: "+34 600 333 444",
        status: "INACTIVE",
      },
    ],
  });

  const hardwareApproval = await prisma.approvalWorkflow.create({
    data: {
      name: "Aprobación estándar Hardware / IT",
      description:
        "Publicar requiere Comprador Senior; adjudicar requiere Administrador.",
      active: true,
      publishRequired: true,
      publishApproverMode: "ROLE",
      publishMinRole: "SENIOR_BUYER",
      awardRequired: true,
      awardApproverMode: "ROLE",
      awardMinRole: "ADMIN",
    },
  });

  const hardwareTemplate = await prisma.rfpTemplate.create({
    data: {
      name: "Estándar Hardware / IT",
      description:
        "Cargos y preguntas de compliance obligatorias para compras de hardware/IT.",
      matchCommodity: "Hardware / IT",
      active: true,
      approvalWorkflowId: hardwareApproval.id,
      items: {
        create: [
          {
            section: "Cargos adicionales",
            name: "Cargo de gestión logística",
            description: "Coordinación de importación y entrega en sitio",
            quantity: 1,
            unit: "servicio",
            weight: 3,
            decimals: 2,
            order: 0,
            lockMinRole: "SENIOR_BUYER",
          },
        ],
      },
    },
  });
  await prisma.templateQuestion.create({
    data: {
      templateId: hardwareTemplate.id,
      section: "Compliance",
      text: "Acepto la política de compliance corporativo para proveedores de hardware",
      type: "TEXT",
      required: true,
      isPrerequisite: true,
      weight: 1,
      order: 0,
      lockMinRole: "ADMIN",
    },
  });
  await prisma.templateQuestion.create({
    data: {
      templateId: hardwareTemplate.id,
      section: "Compliance",
      text: "¿Cuentas con certificación ISO 27001?",
      type: "SELECT",
      options: JSON.stringify(["Sí", "No", "En proceso"]),
      required: true,
      weight: 4,
      order: 1,
      lockMinRole: "BUYER",
    },
  });

  const legalTemplate = await prisma.rfpTemplate.create({
    data: {
      name: "Cláusula legal general",
      description: "Se aplica a cualquier RFP, sin importar commodity o región.",
      matchCommodity: null,
      matchRegion: null,
      active: true,
      questions: {
        create: [
          {
            section: "Legal",
            text: "Acepto los términos generales de contratación de la empresa",
            type: "TEXT",
            required: true,
            isPrerequisite: true,
            weight: 1,
            order: 0,
            lockMinRole: "SENIOR_BUYER",
          },
        ],
      },
    },
  });

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);

  const rfp = await prisma.rfp.create({
    data: {
      number: 1,
      title: "Renovación de laptops para equipo de ventas",
      description:
        "Buscamos cotizaciones para 25 laptops, 25 monitores y soporte de instalación para el equipo comercial del tercer trimestre.",
      buyerName: "Departamento de Compras",
      status: "OPEN",
      deadlineAt: deadline,
      commodity: "Hardware / IT",
      region: "LATAM Norte",
      startDate,
      estimatedPrice: 30000,
      appliedTemplates: JSON.stringify([
        { id: hardwareTemplate.id, name: hardwareTemplate.name },
        { id: legalTemplate.id, name: legalTemplate.name },
      ]),
      createdByUserId: buyerUser.id,
      items: {
        create: [
          {
            section: "Hardware",
            code: "LAP-14",
            name: "Laptop 14'' 16GB RAM",
            description: "Procesador serie i7 o equivalente, 512GB SSD",
            quantity: 25,
            unit: "pieza",
            order: 0,
            weight: 8,
            decimals: 2,
            historicalPrice: 1000,
            commodity: "Hardware / IT",
            customFields: JSON.stringify([
              { label: "Color", value: "Negro o plateado" },
            ]),
          },
          {
            section: "Hardware",
            code: "MON-24",
            name: "Monitor 24'' Full HD",
            description: "Panel IPS, entrada HDMI y DisplayPort",
            quantity: 25,
            unit: "pieza",
            order: 1,
            weight: 5,
            decimals: 2,
            historicalPrice: 170,
            commodity: "Hardware / IT",
            customFields: JSON.stringify([]),
          },
          {
            section: "Servicios",
            code: "SVC-INST",
            name: "Servicio de instalación",
            description: "Configuración e instalación en sitio",
            quantity: 1,
            unit: "servicio",
            order: 2,
            weight: 2,
            decimals: 0,
            historicalPrice: 400,
            customFields: JSON.stringify([
              { label: "Turno", value: "Diurno" },
            ]),
          },
        ],
      },
    },
    include: { items: true },
  });

  const [laptop, monitor, install] = rfp.items;

  const qPrereq = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Requisitos generales",
      text: "Acepto los términos y condiciones de participación en esta RFP",
      type: "TEXT",
      required: true,
      isPrerequisite: true,
      weight: 1,
      order: 0,
    },
  });
  const qDelivery = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Requisitos generales",
      text: "¿Cuál es tu tiempo de entrega estimado?",
      type: "TEXT",
      required: true,
      weight: 6,
      order: 1,
    },
  });
  const qWarranty = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Requisitos generales",
      text: "¿Cuántos años de garantía ofreces?",
      type: "NUMBER",
      required: true,
      weight: 8,
      order: 2,
      numberMin: 1,
      numberMax: 5,
    },
  });
  const qIso = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Requisitos generales",
      text: "¿Tu empresa cuenta con certificación ISO 9001?",
      type: "SELECT",
      options: JSON.stringify(["Sí", "No", "En proceso"]),
      required: true,
      weight: 4,
      order: 3,
    },
  });
  const qIsoCert = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Requisitos generales",
      text: "Indica el número de tu certificado ISO 9001",
      type: "TEXT",
      required: true,
      weight: 2,
      order: 4,
      dependsOnQuestionId: qIso.id,
      dependsOnValue: "Sí",
    },
  });
  const qFreight = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Condiciones comerciales",
      text: "Costo estimado de flete adicional",
      type: "MONEY",
      required: true,
      weight: 3,
      order: 5,
    },
  });
  const qOnsiteSupport = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Condiciones comerciales",
      text: "¿Ofreces soporte técnico en sitio?",
      type: "SELECT",
      options: JSON.stringify(["Sí", "No"]),
      required: true,
      weight: 5,
      order: 6,
      dependsOnHeaderField: "commodity",
      dependsOnValue: "Hardware / IT",
    },
  });
  const qAttachment = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Condiciones comerciales",
      text: "Adjunta tu certificado de garantía (PDF)",
      type: "ATTACHMENT",
      required: false,
      weight: 1,
      order: 7,
    },
  });
  const qNda = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Condiciones comerciales",
      text: "Confirmas haber firmado el NDA de confidencialidad enviado por correo",
      type: "SELECT",
      options: JSON.stringify(["Sí", "No"]),
      required: true,
      weight: 1,
      visibility: "SUPPLIER_ONLY",
      order: 8,
    },
  });
  const qExtendedWarranty = await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      section: "Condiciones comerciales",
      text: "¿Ofreces garantía extendida opcional?",
      type: "YES_NO",
      required: true,
      weight: 2,
      order: 9,
    },
  });
  await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      text: "¿Presupuesto aprobado por finanzas?",
      type: "YES_NO",
      required: false,
      weight: 1,
      respondedBy: "BUYER",
      visibility: "INTERNAL",
      buyerAnswerValue: "Sí",
      order: 10,
    },
  });
  await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      text: "Verificar antecedentes legales del proveedor antes de adjudicar",
      type: "TEXT",
      required: false,
      weight: 1,
      respondedBy: "BUYER",
      visibility: "INTERNAL",
      order: 11,
    },
  });
  await prisma.rfpQuestion.create({
    data: {
      rfpId: rfp.id,
      text: "Nota: garantía menor a 3 años — negociar extensión antes de adjudicar",
      type: "TEXT",
      required: false,
      weight: 1,
      respondedBy: "BUYER",
      visibility: "INTERNAL",
      order: 12,
      dependsOnQuestionId: qWarranty.id,
      dependsOnValue: "2",
    },
  });

  const suppliers = [
    { name: "Laura Méndez", email: "laura@technova.com", company: "TechNova" },
    { name: "Carlos Ibarra", email: "carlos@computel.mx", company: "Computel" },
    { name: "Sofía Ramírez", email: "sofia@digitalpro.com", company: "DigitalPro" },
  ];

  const invitations = [];
  for (const supplier of suppliers) {
    const createdSupplier = await prisma.supplier.create({ data: supplier });
    const invitation = await prisma.invitation.create({
      data: { rfpId: rfp.id, supplierId: createdSupplier.id },
    });
    invitations.push(invitation);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  mkdirSync(uploadsDir, { recursive: true });
  const demoFileName = "demo-garantia-technova.pdf";
  writeFileSync(
    path.join(uploadsDir, demoFileName),
    "Documento de demostración generado por el seed de baseline.RFP.",
  );

  await prisma.invitation.update({
    where: { id: invitations[0].id },
    data: { status: "RESPONDED" },
  });
  await prisma.response.create({
    data: {
      invitationId: invitations[0].id,
      notes: "Precios incluyen envío nacional.",
      itemPrices: {
        create: [
          { itemId: laptop.id, unitPrice: 950 },
          { itemId: monitor.id, unitPrice: 180 },
          { itemId: install.id, unitPrice: 500 },
        ],
      },
      answers: {
        create: [
          { questionId: qPrereq.id, value: "Aceptado" },
          { questionId: qDelivery.id, value: "10 días hábiles", score: 8 },
          { questionId: qWarranty.id, value: "3", score: 7 },
          { questionId: qIso.id, value: "Sí", score: 10 },
          { questionId: qIsoCert.id, value: "ISO-2024-8871", score: 9 },
          { questionId: qFreight.id, value: "150", score: 6 },
          { questionId: qOnsiteSupport.id, value: "Sí", score: 9 },
          {
            questionId: qAttachment.id,
            value: `/uploads/${demoFileName}|garantia-technova.pdf`,
          },
          { questionId: qNda.id, value: "Sí" },
          { questionId: qExtendedWarranty.id, value: "Sí", score: 8 },
        ],
      },
    },
  });

  await prisma.invitation.update({
    where: { id: invitations[1].id },
    data: { status: "RESPONDED" },
  });
  await prisma.response.create({
    data: {
      invitationId: invitations[1].id,
      itemPrices: {
        create: [
          { itemId: laptop.id, unitPrice: 890 },
          { itemId: monitor.id, unitPrice: 210 },
          { itemId: install.id, unitPrice: 350 },
        ],
      },
      answers: {
        create: [
          { questionId: qPrereq.id, value: "Aceptado" },
          { questionId: qDelivery.id, value: "15 días hábiles", score: 5 },
          { questionId: qWarranty.id, value: "2", score: 5 },
          { questionId: qIso.id, value: "En proceso", score: 4 },
          // qIsoCert omitted: Carlos's ISO answer isn't "Sí", so this
          // conditional question stays hidden for him.
          { questionId: qFreight.id, value: "300", score: 3 },
          { questionId: qOnsiteSupport.id, value: "No", score: 3 },
          { questionId: qNda.id, value: "Sí" },
          { questionId: qExtendedWarranty.id, value: "No", score: 4 },
        ],
      },
    },
  });

  await prisma.invitation.update({
    where: { id: invitations[2].id },
    data: { status: "VIEWED", viewedAt: new Date() },
  });

  // A second, minimal RFP owned by a different user, so "Mis RFPs" vs
  // "Todas las RFPs" and the creator filter have something to distinguish.
  const secondDeadline = new Date();
  secondDeadline.setDate(secondDeadline.getDate() + 20);
  const secondRfp = await prisma.rfp.create({
    data: {
      number: 2,
      title: "Servicio de consultoría de procesos",
      description:
        "Diagnóstico y rediseño de procesos de compras para el área de operaciones.",
      buyerName: "Operaciones",
      status: "DRAFT",
      deadlineAt: secondDeadline,
      commodity: "Servicios profesionales",
      region: "EMEA",
      createdByUserId: seniorUser.id,
      items: {
        create: [
          {
            name: "Diagnóstico inicial",
            description: "Levantamiento de procesos actuales",
            quantity: 1,
            unit: "servicio",
            order: 0,
          },
        ],
      },
    },
  });

  // RFP histórica cerrada, con un artículo de mismo código que la RFP
  // principal, para poblar la sección "Precios de proyectos anteriores"
  // del Monitor.
  const historicalRfp = await prisma.rfp.create({
    data: {
      number: 3,
      title: "Compra de laptops Q1 (histórica)",
      description: "Renovación de equipo para el área administrativa.",
      buyerName: "Departamento de Compras",
      status: "CLOSED",
      deadlineAt: new Date(deadline.getTime() - 1000 * 60 * 60 * 24 * 120),
      commodity: "Hardware / IT",
      region: "LATAM Norte",
      createdByUserId: buyerUser.id,
      items: {
        create: [
          {
            code: "LAP-14",
            name: "Laptop 14'' 16GB RAM",
            description: "Procesador serie i7 o equivalente, 512GB SSD",
            quantity: 10,
            unit: "pieza",
            order: 0,
          },
        ],
      },
    },
    include: { items: true },
  });
  const historicalSupplier = await prisma.supplier.create({
    data: {
      name: "Carlos Ibarra",
      email: "carlos@computel.mx",
      company: "Computel",
    },
  });
  const historicalInvitation = await prisma.invitation.create({
    data: {
      rfpId: historicalRfp.id,
      supplierId: historicalSupplier.id,
      status: "RESPONDED",
    },
  });
  await prisma.response.create({
    data: {
      invitationId: historicalInvitation.id,
      itemPrices: {
        create: [{ itemId: historicalRfp.items[0].id, unitPrice: 870 }],
      },
    },
  });

  console.log("Seed completo:");
  console.log(`RFP: ${rfp.title} (${rfp.id})`);
  for (const inv of invitations) {
    console.log(`  /respond/${inv.token}`);
  }
  console.log(`RFP 2: ${secondRfp.title} (${secondRfp.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
