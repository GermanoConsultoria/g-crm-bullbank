export type FormSubmissionType = "parceiro" | "cliente";

export type FormFieldDef = {
  key: string;
  label: string;
  type: "input" | "textarea";
};

export type FormSectionDef = {
  title?: string;
  fields: FormFieldDef[];
};

export type FormTemplate = {
  label: string;
  sections: FormSectionDef[];
};

export const FORM_TEMPLATES: Record<FormSubmissionType, FormTemplate> = {
  parceiro: {
    label: "Parceiro",
    sections: [
      {
        fields: [
          { key: "nome", label: "Nome", type: "input" },
          { key: "empresa", label: "Empresa", type: "input" },
          { key: "segmento_atuacao", label: "Segmento de atuação", type: "input" },
        ],
      },
      {
        fields: [
          { key: "especialidade", label: "Qual é a sua especialidade/serviço principal?", type: "textarea" },
          {
            key: "explicacao_empresa",
            label: "Como você explicaria, de forma simples, o que sua empresa faz e para quem?",
            type: "textarea",
          },
          { key: "diferencial", label: "O que te faz único? Qual seu diferencial?", type: "textarea" },
          { key: "bom_cliente", label: "Descreva quem é um bom cliente para você:", type: "textarea" },
          {
            key: "regioes_atendidas",
            label: "Em quais regiões você atende? (Local; Regional; Nacional)",
            type: "input",
          },
          {
            key: "contatos_oportunidade",
            label:
              "Quais empresas ou contatos você acredita que poderiam ter uma oportunidade de conversar com a Germano?",
            type: "textarea",
          },
          { key: "principais_clientes", label: "Quem são os seus principais tipos de clientes?", type: "textarea" },
          { key: "ultimos_clientes", label: "Quais foram alguns dos seus últimos clientes?", type: "textarea" },
          {
            key: "segmentos_parceiros",
            label: "Quais segmentos ou profissionais você considera bons parceiros para gerar indicações?",
            type: "textarea",
          },
          {
            key: "parcerias_atuais",
            label:
              "Você já possui parcerias ou costuma receber indicações de outros profissionais? Se sim, de quais áreas?",
            type: "textarea",
          },
        ],
      },
      {
        title: "Próximos passos",
        fields: [
          { key: "oportunidades_identificadas", label: "Principais oportunidades identificadas:", type: "textarea" },
          { key: "possiveis_indicacoes", label: "Possíveis indicações/parcerias:", type: "textarea" },
          {
            key: "acoes_negocios_conjunto",
            label: "Ações que podemos realizar para gerar negócios em conjunto:",
            type: "textarea",
          },
          { key: "proximo_passo", label: "Próximo passo definido:", type: "textarea" },
        ],
      },
      {
        title: "Observações",
        fields: [{ key: "observacoes", label: "Observações", type: "textarea" }],
      },
    ],
  },
  cliente: {
    label: "Cliente",
    sections: [
      {
        fields: [
          { key: "nome", label: "Nome", type: "input" },
          { key: "empresa", label: "Empresa", type: "input" },
          { key: "area_atuacao", label: "Área de atuação", type: "input" },
        ],
      },
      {
        fields: [
          {
            key: "produtos_servicos",
            label: "Quais são os principais produtos ou serviços oferecidos pela empresa?",
            type: "textarea",
          },
          { key: "processos_principais", label: "Quais são os principais processos da empresa hoje?", type: "textarea" },
          { key: "maior_dor", label: "Qual é a maior dor ou dificuldade da empresa atualmente?", type: "textarea" },
          {
            key: "areas_melhoria",
            label: "Quais áreas da empresa você acredita que precisam de mais atenção ou melhoria?",
            type: "textarea",
          },
          { key: "sistema_atual", label: "Qual sistema a empresa utiliza atualmente?", type: "input" },
          {
            key: "uso_planilhas",
            label: "A empresa utiliza muitas planilhas no dia a dia? Em quais áreas?",
            type: "textarea",
          },
          {
            key: "processos_demorados",
            label: "Em quais processos vocês sentem que perdem mais tempo?",
            type: "textarea",
          },
        ],
      },
      {
        title: "Próximos passos",
        fields: [
          { key: "pontos_identificados", label: "Principais pontos identificados na reunião:", type: "textarea" },
          { key: "necessidade_prioridade", label: "Necessidade/prioridade identificada:", type: "textarea" },
          { key: "solucao_sugerida", label: "Solução ou ação sugerida:", type: "textarea" },
          { key: "proximo_passo", label: "Próximo passo definido:", type: "textarea" },
        ],
      },
      {
        title: "Observações",
        fields: [{ key: "observacoes", label: "Observações", type: "textarea" }],
      },
    ],
  },
};
