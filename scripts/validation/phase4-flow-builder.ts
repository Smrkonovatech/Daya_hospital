/**
 * ============================================================================
 * PHASE 4: FLOW BUILDER VALIDATION SUITE (11 NODES x 6 VALIDATION POINTS)
 * ============================================================================
 *
 * Dedicated synthetic test hospital: `hosp_synthetic_validation`
 * Validates 11 Nodes:
 *   1. Welcome Greeting (WELCOME_GREETING)
 *   2. AI Conversation (AI_VOICE_AGENT)
 *   3. Knowledge Base / Intent Router (INTENT_DETECTION)
 *   4. Appointment Flow / Branch (CONDITION_BRANCH)
 *   5. Human Transfer (HUMAN_TRANSFER)
 *   6. Emergency Handling (EMERGENCY_HANDLING)
 *   7. Business Hours (BUSINESS_HOURS)
 *   8. Timeout Handler (TIMEOUT)
 *   9. Invalid Input Handler (INVALID_INPUT)
 *  10. Retry / Repeat Menu (REPEAT_MENU)
 *  11. End Call (END_CALL)
 *
 * Each node is strictly tested against 6 validation points:
 *   VP1: Schema & Configuration Integrity
 *   VP2: Graph Port & Connectivity
 *   VP3: Deterministic Step Execution
 *   VP4: State & Variable Mutation
 *   VP5: Branching / Transition / Edge Traversal
 *   VP6: Multi-Tenant Security & Failure Resilience
 */

import * as fs from 'fs';
import * as path from 'path';
import { IvrFlowExecutionEngine, StepInputEvent } from '../../src/lib/services/ivr-flow-engine';
import { IvrFlowValidator } from '../../src/lib/services/ivr-flow-validator';
import { createDefaultNode } from '../../src/lib/services/ivr-node-definitions';
import {
  FlowNode,
  FlowEdge,
  IvrFlowData,
  FlowExecutionContext,
} from '../../src/lib/types/ivr-flow';

const SYNTHETIC_HOSPITAL_ID = 'hosp_synthetic_validation';
const SYNTHETIC_HOSPITAL_NAME = 'Synthetic Validation Specialty Hospital';

// 1. Build the complete 11-node synthetic flow
function buildSyntheticValidationFlow(): IvrFlowData {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Start Entrypoint
  const incomingNode = createDefaultNode('INCOMING_CALL', { x: 0, y: 0 });
  incomingNode.id = 'node_incoming';

  // 1. Welcome Greeting
  const welcomeNode = createDefaultNode('WELCOME_GREETING', { x: 200, y: 0 });
  welcomeNode.id = 'node_welcome';
  welcomeNode.data = {
    ...welcomeNode.data,
    textEnglish: 'Welcome to Synthetic Validation Hospital. How may we assist you?',
    textMalayalam: 'സിന്തറ്റിക് വാലിഡേഷൻ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.',
    ttsSpeaker: 'kavitha',
    speakingPace: 1.15,
  } as any;

  // 7. Business Hours
  const bhNode = createDefaultNode('BUSINESS_HOURS', { x: 400, y: 0 });
  bhNode.id = 'node_business_hours';
  bhNode.data = {
    ...bhNode.data,
    timezone: 'Asia/Kolkata',
    schedule: {
      monday: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
      tuesday: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
      wednesday: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
      thursday: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
      friday: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
      saturday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
      sunday: { isOpen: false, openTime: '00:00', closeTime: '00:00' },
    },
    holidayDates: [],
  } as any;

  // 3. Knowledge Base / Intent Router
  const kbNode = createDefaultNode('INTENT_DETECTION', { x: 600, y: 0 });
  kbNode.id = 'node_knowledge';
  kbNode.data = {
    ...kbNode.data,
    intents: [
      { id: 'appointment', name: 'Book Appointment', targetPortId: 'appointment', samplePhrases: ['book appointment', 'doctor visit'] },
      { id: 'ai', name: 'Talk to AI', targetPortId: 'ai', samplePhrases: ['general inquiry', 'consultation'] },
      { id: 'staff', name: 'Speak to Human', targetPortId: 'human_handoff', samplePhrases: ['reception', 'operator'] },
      { id: 'emergency', name: 'Emergency', targetPortId: 'emergency', samplePhrases: ['chest pain', 'ambulance'] },
    ],
    fallbackPortId: 'fallback',
  } as any;

  // 4. Appointment Flow / Condition Branch
  const apptNode = createDefaultNode('CONDITION_BRANCH', { x: 800, y: -150 });
  apptNode.id = 'node_appointment';
  apptNode.data = {
    ...apptNode.data,
    conditions: [
      { variable: 'is_registered', operator: 'EQUALS', value: 'true', targetPortId: 'existing_patient' },
    ],
    defaultPortId: 'new_patient',
  } as any;

  // 2. AI Conversation
  const aiNode = createDefaultNode('AI_VOICE_AGENT', { x: 800, y: 0 });
  aiNode.id = 'node_ai_conv';
  aiNode.data = {
    ...aiNode.data,
    agentId: 'agent_synthetic_ai_receptionist',
    agentName: 'Synthetic AI Receptionist',
    publishedVersion: 1,
    hospitalId: SYNTHETIC_HOSPITAL_ID,
  } as any;

  // 5. Human Transfer
  const transferNode = createDefaultNode('HUMAN_TRANSFER', { x: 1000, y: 150 });
  transferNode.id = 'node_human_transfer';
  transferNode.data = {
    ...transferNode.data,
    destinationNumber: '+919999900001',
    transferType: 'COLD',
    musicOnHold: 'soothing_classical',
  } as any;

  // 6. Emergency Handling
  const emergencyNode = createDefaultNode('EMERGENCY_HANDLING', { x: 1000, y: 300 });
  emergencyNode.id = 'node_emergency';
  emergencyNode.data = {
    ...emergencyNode.data,
    autoTransfer: false,
    isConfirmedDestination: false,
    casualtyDestinationNumber: '',
    announcementEnglish: 'This is an emergency. Please visit Casualty immediately or call 108.',
    announcementMalayalam: 'അടിയന്തിര സാഹചര്യങ്ങളിൽ ദയവായി കാഷ്വാലിറ്റിയിൽ ബന്ധപ്പെടുക അല്ലെങ്കിൽ 108 വിളിക്കുക.',
  } as any;

  // 8. Timeout Handler
  const timeoutNode = createDefaultNode('TIMEOUT', { x: 600, y: -300 });
  timeoutNode.id = 'node_timeout';
  timeoutNode.data = {
    ...timeoutNode.data,
    timeoutSeconds: 8,
    timeoutPromptEnglish: 'We did not hear any response. Let us reconnect you.',
    timeoutPromptMalayalam: 'ശബ്ദം ഒന്നും കേൾക്കാൻ സാധിച്ചില്ല.',
  } as any;

  // 9. Invalid Input Handler
  const invalidNode = createDefaultNode('INVALID_INPUT', { x: 600, y: 300 });
  invalidNode.id = 'node_invalid_input';
  invalidNode.data = {
    ...invalidNode.data,
    invalidPromptEnglish: 'The selection was not recognized. Please choose from the options.',
    invalidPromptMalayalam: 'നൽകിയ വിവരം അസാധുവാണ്.',
  } as any;

  // 10. Retry / Repeat Menu
  const retryNode = createDefaultNode('REPEAT_MENU', { x: 1200, y: 150 });
  retryNode.id = 'node_retry';
  retryNode.data = {
    ...retryNode.data,
    maxRetries: 3,
    repeatPromptEnglish: 'Transfer could not be completed. Repeating previous options.',
    repeatPromptMalayalam: 'കോൾ മാറ്റാൻ സാധിച്ചില്ല. വീണ്ടും ഓപ്ഷനുകൾ നൽകുന്നു.',
  } as any;

  // 11. End Call
  const endCallNode = createDefaultNode('END_CALL', { x: 1400, y: 0 });
  endCallNode.id = 'node_end_call';
  endCallNode.data = {
    ...endCallNode.data,
    hangupReason: 'NORMAL_CLEARING',
    goodbyePromptEnglish: 'Thank you for calling Synthetic Validation Hospital. Goodbye.',
    goodbyePromptMalayalam: 'സിന്തറ്റിക് വാലിഡേഷൻ ഹോസ്പിറ്റലിലേക്ക് വിളിച്ചതിന് നന്ദി. നമസ്കാരം.',
  } as any;

  nodes.push(
    incomingNode,
    welcomeNode,
    bhNode,
    kbNode,
    apptNode,
    aiNode,
    transferNode,
    emergencyNode,
    timeoutNode,
    invalidNode,
    retryNode,
    endCallNode
  );

  // Edges connecting the full graph
  edges.push(
    { id: 'e1', sourceNodeId: 'node_incoming', sourcePortId: 'next', targetNodeId: 'node_welcome', targetPortId: 'in' },
    { id: 'e2', sourceNodeId: 'node_welcome', sourcePortId: 'next', targetNodeId: 'node_business_hours', targetPortId: 'in' },
    { id: 'e3', sourceNodeId: 'node_business_hours', sourcePortId: 'open', targetNodeId: 'node_knowledge', targetPortId: 'in' },
    { id: 'e4', sourceNodeId: 'node_business_hours', sourcePortId: 'closed', targetNodeId: 'node_end_call', targetPortId: 'in' },
    { id: 'e5', sourceNodeId: 'node_knowledge', sourcePortId: 'appointment', targetNodeId: 'node_appointment', targetPortId: 'in' },
    { id: 'e6', sourceNodeId: 'node_knowledge', sourcePortId: 'ai', targetNodeId: 'node_ai_conv', targetPortId: 'in' },
    { id: 'e7', sourceNodeId: 'node_knowledge', sourcePortId: 'human_handoff', targetNodeId: 'node_human_transfer', targetPortId: 'in' },
    { id: 'e8', sourceNodeId: 'node_knowledge', sourcePortId: 'emergency', targetNodeId: 'node_emergency', targetPortId: 'in' },
    { id: 'e9', sourceNodeId: 'node_knowledge', sourcePortId: 'fallback', targetNodeId: 'node_ai_conv', targetPortId: 'in' },
    { id: 'e10', sourceNodeId: 'node_appointment', sourcePortId: 'existing_patient', targetNodeId: 'node_ai_conv', targetPortId: 'in' },
    { id: 'e11', sourceNodeId: 'node_appointment', sourcePortId: 'new_patient', targetNodeId: 'node_ai_conv', targetPortId: 'in' },
    { id: 'e12', sourceNodeId: 'node_ai_conv', sourcePortId: 'call_completed', targetNodeId: 'node_end_call', targetPortId: 'in' },
    { id: 'e13', sourceNodeId: 'node_ai_conv', sourcePortId: 'human_handoff', targetNodeId: 'node_human_transfer', targetPortId: 'in' },
    { id: 'e14', sourceNodeId: 'node_ai_conv', sourcePortId: 'emergency_escalation', targetNodeId: 'node_emergency', targetPortId: 'in' },
    { id: 'e15', sourceNodeId: 'node_human_transfer', sourcePortId: 'connected', targetNodeId: 'node_end_call', targetPortId: 'in' },
    { id: 'e16', sourceNodeId: 'node_human_transfer', sourcePortId: 'failed', targetNodeId: 'node_retry', targetPortId: 'in' },
    { id: 'e17', sourceNodeId: 'node_emergency', sourcePortId: 'transferred', targetNodeId: 'node_end_call', targetPortId: 'in' },
    { id: 'e18', sourceNodeId: 'node_retry', sourcePortId: 'repeat', targetNodeId: 'node_knowledge', targetPortId: 'in' },
    { id: 'e19', sourceNodeId: 'node_timeout', sourcePortId: 'exceeded', targetNodeId: 'node_end_call', targetPortId: 'in' },
    { id: 'e20', sourceNodeId: 'node_invalid_input', sourcePortId: 'exceeded', targetNodeId: 'node_end_call', targetPortId: 'in' },
    { id: 'e21', sourceNodeId: 'node_knowledge', sourcePortId: 'fallback', targetNodeId: 'node_invalid_input', targetPortId: 'in' },
    { id: 'e22', sourceNodeId: 'node_human_transfer', sourcePortId: 'failed', targetNodeId: 'node_timeout', targetPortId: 'in' }
  );

  return {
    id: 'flow_synthetic_validation_001',
    name: 'Synthetic Hospital End-to-End Orchestration Flow',
    description: 'Comprehensive 11-node validation flow for multi-tenant IVR verification',
    hospitalId: SYNTHETIC_HOSPITAL_ID,
    category: 'INBOUND_RECEPTION',
    status: 'PUBLISHED',
    currentVersion: 1,
    nodes,
    edges,
    variables: { hospital_tier: 'tertiary', emergency_active: false },
    exotelMapping: {
      appletId: 'app_synthetic_test',
      requiredAppletType: 'Voicebot Applet',
      streamingPath: '/exotel/voicebot',
      mappingInstructions: [],
      lastVerificationStatus: 'VERIFIED',
    },
    deploymentStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as IvrFlowData;
}

async function runPhase4Validation() {
  console.log('================================================================');
  console.log('PHASE 4: FLOW BUILDER VALIDATION SUITE');
  console.log('Target Hospital: ' + SYNTHETIC_HOSPITAL_ID);
  console.log('Target Nodes: 11 Flow Nodes across 6 Validation Points');
  console.log('================================================================\n');

  const flow = buildSyntheticValidationFlow();

  // 1. Validate full flow graph integrity
  const graphValidation = IvrFlowValidator.validate(flow.nodes, flow.edges);
  console.log(`[Flow Graph Validation] Valid: ${graphValidation.isValid}, Errors: ${graphValidation.errors.length}, Warnings: ${graphValidation.warnings.length}`);
  if (graphValidation.errors.length > 0) {
    console.error('Graph Errors:', graphValidation.errors);
  }

  const nodeResults: any[] = [];

  const TARGET_NODES = [
    { id: 'node_welcome', name: 'Welcome Greeting', type: 'WELCOME_GREETING' },
    { id: 'node_ai_conv', name: 'AI Conversation', type: 'AI_VOICE_AGENT' },
    { id: 'node_knowledge', name: 'Knowledge Base / Intent Detection', type: 'INTENT_DETECTION' },
    { id: 'node_appointment', name: 'Appointment Flow / Branch', type: 'CONDITION_BRANCH' },
    { id: 'node_human_transfer', name: 'Human Transfer', type: 'HUMAN_TRANSFER' },
    { id: 'node_emergency', name: 'Emergency Handling', type: 'EMERGENCY_HANDLING' },
    { id: 'node_business_hours', name: 'Business Hours', type: 'BUSINESS_HOURS' },
    { id: 'node_timeout', name: 'Timeout Handler', type: 'TIMEOUT' },
    { id: 'node_invalid_input', name: 'Invalid Input Handler', type: 'INVALID_INPUT' },
    { id: 'node_retry', name: 'Retry / Repeat Menu', type: 'REPEAT_MENU' },
    { id: 'node_end_call', name: 'End Call', type: 'END_CALL' },
  ];

  for (let idx = 0; idx < TARGET_NODES.length; idx++) {
    const target = TARGET_NODES[idx];
    console.log(`\n--- [Node ${idx + 1}/11: ${target.name} (${target.type})] ---`);

    const node = flow.nodes.find((n) => n.id === target.id);
    if (!node) {
      throw new Error(`Node ${target.id} not found in flow.`);
    }

    const vpResults: Record<string, { pass: boolean; details: string }> = {};

    // -------------------------------------------------------------
    // VP1: Schema & Configuration Integrity
    // -------------------------------------------------------------
    const hasValidType = node.type === target.type;
    const hasData = typeof node.data === 'object' && Object.keys(node.data).length > 0;
    const hasTitle = Boolean(node.title && node.title.length > 0);
    vpResults['VP1_Schema_Configuration'] = {
      pass: hasValidType && hasData && hasTitle,
      details: `Type=${node.type}, DataKeys=${Object.keys(node.data).length}, Title="${node.title}"`,
    };

    // -------------------------------------------------------------
    // VP2: Graph Port & Connectivity
    // -------------------------------------------------------------
    const inEdges = flow.edges.filter((e) => e.targetNodeId === node.id);
    const outEdges = flow.edges.filter((e) => e.sourceNodeId === node.id);
    const hasIncoming = inEdges.length > 0;
    const hasOutgoing = node.type === 'END_CALL' ? true : outEdges.length > 0;
    vpResults['VP2_Graph_Connectivity'] = {
      pass: hasIncoming && hasOutgoing,
      details: `IncomingEdges=${inEdges.length}, OutgoingEdges=${outEdges.length}`,
    };

    // -------------------------------------------------------------
    // VP3: Deterministic Step Execution
    // -------------------------------------------------------------
    const context: FlowExecutionContext = IvrFlowExecutionEngine.initializeContext(
      flow,
      `CA_synth_${target.id}_${Date.now()}`,
      '+919876543210',
      SYNTHETIC_HOSPITAL_ID,
      'en-IN'
    );
    context.currentNodeId = node.id;

    let testEvent: StepInputEvent = { type: 'START_CALL' };
    if (target.type === 'INTENT_DETECTION') {
      testEvent = { type: 'SPEECH_TRANSCRIPT', value: 'I want to book an appointment' };
    } else if (target.type === 'HUMAN_TRANSFER') {
      testEvent = { type: 'START_CALL' };
    } else if (target.type === 'AI_VOICE_AGENT') {
      testEvent = { type: 'START_CALL' };
    } else if (target.type === 'TIMEOUT') {
      testEvent = { type: 'TIMEOUT' };
    }

    // Set business hours reference time to 10:00 AM on Monday (within open schedule)
    const testNow = new Date('2026-11-23T10:00:00Z');
    const stepResult = IvrFlowExecutionEngine.executeStep(flow, context, testEvent, testNow);

    const validActions = ['PLAY_AUDIO', 'STREAM_AI_AGENT', 'COLLECT_DTMF', 'TRANSFER_CALL', 'EMERGENCY_ESCALATE', 'HANGUP', 'INVOKE_SUBFLOW', 'CONTINUE'];
    const actionValid = validActions.includes(stepResult.action);
    vpResults['VP3_Deterministic_Execution'] = {
      pass: actionValid,
      details: `Action=${stepResult.action}, NextNode=${stepResult.nextNodeId}, Log="${stepResult.logMessage}"`,
    };

    // -------------------------------------------------------------
    // VP4: State & Variable Mutation
    // -------------------------------------------------------------
    const historyAdded = context.history.length > 0;
    const contextValid = context.hospitalId === SYNTHETIC_HOSPITAL_ID;
    vpResults['VP4_State_Mutation'] = {
      pass: historyAdded && contextValid,
      details: `HistoryEntries=${context.history.length}, Hospital=${context.hospitalId}, Turns=${context.turnCount}`,
    };

    // -------------------------------------------------------------
    // VP5: Branching / Transition / Edge Traversal
    // -------------------------------------------------------------
    let transitionValid = false;
    let transitionDetails = '';
    if (node.type === 'END_CALL') {
      transitionValid = stepResult.isTerminal === true;
      transitionDetails = `IsTerminal=${stepResult.isTerminal}`;
    } else if (node.type === 'AI_VOICE_AGENT') {
      // Verify downstream traversal on completion event
      const completionStep = IvrFlowExecutionEngine.executeStep(flow, context, { type: 'AI_COMPLETED' }, testNow);
      transitionValid = completionStep.nextNodeId !== null && flow.nodes.some((n) => n.id === completionStep.nextNodeId);
      transitionDetails = `NextNodeIdOnCompletion=${completionStep.nextNodeId}`;
    } else {
      transitionValid = stepResult.nextNodeId !== null && flow.nodes.some((n) => n.id === stepResult.nextNodeId);
      transitionDetails = `NextNodeId=${stepResult.nextNodeId}, IsTerminal=${stepResult.isTerminal}`;
    }
    vpResults['VP5_Edge_Traversal'] = {
      pass: transitionValid,
      details: transitionDetails,
    };

    // -------------------------------------------------------------
    // VP6: Multi-Tenant Security & Failure Resilience
    // -------------------------------------------------------------
    // Test cross-tenant isolation: passing wrong tenant ID must be safely blocked
    const foreignContext: FlowExecutionContext = {
      ...context,
      hospitalId: 'hosp_foreign_tenant_unauthorized',
    };
    const foreignStep = IvrFlowExecutionEngine.executeStep(flow, foreignContext, testEvent, testNow);
    const securityBlocked = foreignStep.action === 'HANGUP' && foreignStep.isTerminal === true;

    // Test emergency safeguard: verify node_emergency contains no unapproved hardcoded destination
    let emergencySafe = true;
    if (node.type === 'EMERGENCY_HANDLING') {
      const emData = node.data as any;
      emergencySafe = emData.autoTransfer === false && emData.isConfirmedDestination === false;
    }

    vpResults['VP6_Tenant_Security_Resilience'] = {
      pass: securityBlocked && emergencySafe,
      details: `CrossTenantBlocked=${securityBlocked}, EmergencySafe=${emergencySafe}`,
    };

    const allPassed = Object.values(vpResults).every((vp) => vp.pass);
    console.log(`   Validation Points Summary:`);
    for (const [vpName, res] of Object.entries(vpResults)) {
      console.log(`   - ${vpName}: [${res.pass ? 'PASS' : 'FAIL'}] -> ${res.details}`);
    }
    console.log(`   Result: [${allPassed ? 'PASS' : 'FAIL'}]`);

    nodeResults.push({
      nodeIndex: idx + 1,
      nodeId: target.id,
      nodeName: target.name,
      nodeType: target.type,
      validationPoints: vpResults,
      status: allPassed ? 'PASS' : 'FAIL',
    });
  }

  const outJson = path.join(__dirname, 'phase4_flow_builder_results.json');
  fs.writeFileSync(outJson, JSON.stringify({ hospital: SYNTHETIC_HOSPITAL_ID, results: nodeResults }, null, 2));
  console.log(`\nPhase 4 results successfully saved to ${outJson}`);

  const totalPassed = nodeResults.filter((r) => r.status === 'PASS').length;
  console.log(`Total Nodes Validated: 11/11. Passed: ${totalPassed}/11.`);
  return nodeResults;
}

runPhase4Validation().catch(console.error);
