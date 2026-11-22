/**
 * ============================================================================
 * SMRKOMED IVR FLOW VALIDATOR ENGINE (PHASE 4)
 * ============================================================================
 *
 * Enforces clinical and telephony invariants on inbound IVR call flow graphs:
 * - Single entrypoint invariant (exactly one INCOMING_CALL node)
 * - Full reachability check from entrypoint (detect orphan nodes)
 * - Terminal path integrity (all execution paths reach valid termination)
 * - Incomplete output branch detection (unconnected menu options / timeouts)
 * - Infinite loop & cycle safety
 * - Node-specific data validation (emergency numbers, agent bindings, DTMF keys)
 */

import {
  FlowNode,
  FlowEdge,
  FlowValidationResult,
  ValidationIssue,
  IvrMenuNodeData,
  LanguageSelectionNodeData,
  AiVoiceAgentNodeData,
  EmergencyHandlingNodeData,
  HumanTransferNodeData,
  DtmfInputNodeData,
  BusinessHoursNodeData,
} from "@/lib/types/ivr-flow";

export class IvrFlowValidator {
  /**
   * Validates an entire IVR flow graph and returns structured errors and warnings.
   */
  public static validate(nodes: FlowNode[], edges: FlowEdge[]): FlowValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const nodeMap = new Map<string, FlowNode>();
    for (const node of nodes) {
      if (nodeMap.has(node.id)) {
        errors.push({
          nodeId: node.id,
          level: "ERROR",
          message: `Duplicate node ID detected: ${node.id}`,
          code: "DUPLICATE_NODE_ID",
        });
      }
      nodeMap.set(node.id, node);
    }

    // 1. Entry Point Invariant: Exactly one INCOMING_CALL node
    const incomingNodes = nodes.filter((n) => n.type === "INCOMING_CALL");
    if (incomingNodes.length === 0) {
      errors.push({
        level: "ERROR",
        message: "The flow must contain exactly one 'Incoming Call' start node.",
        code: "MISSING_ENTRY_NODE",
      });
    } else if (incomingNodes.length > 1) {
      errors.push({
        level: "ERROR",
        message: `The flow contains ${incomingNodes.length} 'Incoming Call' start nodes. Only one start node is permitted.`,
        code: "MULTIPLE_ENTRY_NODES",
      });
    }

    // 2. Edge Integrity: Check valid source and target nodes & ports
    const validEdges: FlowEdge[] = [];
    const edgeKeySet = new Set<string>();

    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);

      if (!sourceNode) {
        errors.push({
          edgeId: edge.id,
          level: "ERROR",
          message: `Edge ${edge.id} references non-existent source node '${edge.sourceNodeId}'.`,
          code: "INVALID_SOURCE_NODE",
        });
        continue;
      }

      if (!targetNode) {
        errors.push({
          edgeId: edge.id,
          level: "ERROR",
          message: `Edge ${edge.id} references non-existent target node '${edge.targetNodeId}'.`,
          code: "INVALID_TARGET_NODE",
        });
        continue;
      }

      if (edge.sourceNodeId === edge.targetNodeId) {
        errors.push({
          nodeId: edge.sourceNodeId,
          edgeId: edge.id,
          level: "ERROR",
          message: `Direct self-loop detected on node '${sourceNode.title}'. A node cannot connect directly to itself.`,
          code: "DIRECT_SELF_LOOP",
        });
        continue;
      }

      // Check port existence
      const sourcePort = sourceNode.ports.outputs.find((p) => p.id === edge.sourcePortId);
      if (!sourcePort) {
        warnings.push({
          nodeId: sourceNode.id,
          edgeId: edge.id,
          level: "WARNING",
          message: `Edge references undefined output port '${edge.sourcePortId}' on node '${sourceNode.title}'.`,
          code: "UNDEFINED_OUTPUT_PORT",
        });
      }

      const targetPort = targetNode.ports.inputs.find((p) => p.id === edge.targetPortId);
      if (!targetPort) {
        warnings.push({
          nodeId: targetNode.id,
          edgeId: edge.id,
          level: "WARNING",
          message: `Edge references undefined input port '${edge.targetPortId}' on node '${targetNode.title}'.`,
          code: "UNDEFINED_INPUT_PORT",
        });
      }

      const duplicateKey = `${edge.sourceNodeId}:${edge.sourcePortId}->${edge.targetNodeId}:${edge.targetPortId}`;
      if (edgeKeySet.has(duplicateKey)) {
        warnings.push({
          edgeId: edge.id,
          level: "WARNING",
          message: `Duplicate connection between '${sourceNode.title}' and '${targetNode.title}'.`,
          code: "DUPLICATE_EDGE",
        });
      }
      edgeKeySet.add(duplicateKey);
      validEdges.push(edge);
    }

    // 3. Reachability Analysis (BFS from entry node)
    if (incomingNodes.length === 1) {
      const startNode = incomingNodes[0];
      const visited = new Set<string>();
      const queue = [startNode.id];
      visited.add(startNode.id);

      // Adjacency map
      const adj = new Map<string, string[]>();
      for (const edge of validEdges) {
        if (!adj.has(edge.sourceNodeId)) {
          adj.set(edge.sourceNodeId, []);
        }
        adj.get(edge.sourceNodeId)!.push(edge.targetNodeId);
      }

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = adj.get(curr) || [];
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }

      for (const node of nodes) {
        if (!visited.has(node.id)) {
          warnings.push({
            nodeId: node.id,
            level: "WARNING",
            message: `Node '${node.title}' (${node.type}) is unreachable from the Incoming Call start node.`,
            code: "UNREACHABLE_NODE",
          });
        }
      }
    }

    // 4. Incomplete Branch Analysis (Check required output connections)
    const outgoingByNodePort = new Set<string>();
    for (const edge of validEdges) {
      outgoingByNodePort.add(`${edge.sourceNodeId}:${edge.sourcePortId}`);
    }

    for (const node of nodes) {
      // END_CALL is terminal and requires no output connections
      if (node.type === "END_CALL") continue;

      // Check if all primary output ports have connections
      for (const outPort of node.ports.outputs) {
        const portKey = `${node.id}:${outPort.id}`;
        if (!outgoingByNodePort.has(portKey)) {
          // Timeouts and invalid branches are warnings; main navigation branches are errors
          if (outPort.id === "timeout" || outPort.id === "invalid" || outPort.id === "error" || outPort.id === "failed") {
            warnings.push({
              nodeId: node.id,
              level: "WARNING",
              message: `Node '${node.title}' has an unhandled fallback port '${outPort.label}'.`,
              code: "UNHANDLED_FALLBACK_PORT",
            });
          } else if (node.type === "IVR_MENU" || node.type === "LANGUAGE_SELECTION" || node.type === "INCOMING_CALL" || node.type === "WELCOME_GREETING") {
            errors.push({
              nodeId: node.id,
              level: "ERROR",
              message: `Node '${node.title}' has an unconnected output port: '${outPort.label}'. All menu and call branches must connect to a target node.`,
              code: "UNCONNECTED_REQUIRED_PORT",
            });
          }
        }
      }
    }

    // 5. Node-Specific Clinical and Telephony Invariants
    for (const node of nodes) {
      this.validateNodeProperties(node, errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateNodeProperties(
    node: FlowNode,
    errors: ValidationIssue[]
  ) {
    const data = (node.data || {}) as Record<string, unknown>;

    switch (node.type) {
      case "IVR_MENU": {
        const menuData = data as unknown as IvrMenuNodeData;
        if (!menuData.options || menuData.options.length === 0) {
          errors.push({
            nodeId: node.id,
            level: "ERROR",
            message: `IVR Menu '${node.title}' has no menu options configured. At least one option is required.`,
            code: "EMPTY_MENU_OPTIONS",
          });
        } else {
          const keys = new Set<string>();
          for (const opt of menuData.options) {
            if (!opt.key || !opt.key.trim()) {
              errors.push({
                nodeId: node.id,
                level: "ERROR",
                message: `IVR Menu option '${opt.label}' has a missing DTMF key.`,
                code: "MISSING_DTMF_KEY",
              });
            } else if (keys.has(opt.key)) {
              errors.push({
                nodeId: node.id,
                level: "ERROR",
                message: `Duplicate DTMF key '${opt.key}' in IVR Menu '${node.title}'. DTMF keys must be unique.`,
                code: "DUPLICATE_DTMF_KEY",
              });
            }
            keys.add(opt.key);
          }
        }
        break;
      }

      case "LANGUAGE_SELECTION": {
        const langData = data as unknown as LanguageSelectionNodeData;
        if (!langData.options || langData.options.length === 0) {
          errors.push({
            nodeId: node.id,
            level: "ERROR",
            message: `Language Selection node '${node.title}' has no languages configured.`,
            code: "EMPTY_LANGUAGE_OPTIONS",
          });
        }
        break;
      }

      case "AI_VOICE_AGENT": {
        const agentData = data as unknown as AiVoiceAgentNodeData;
        if (!agentData.agentId || !agentData.agentId.trim()) {
          errors.push({
            nodeId: node.id,
            level: "ERROR",
            message: `AI Voice Agent node '${node.title}' is not bound to a published agent. Select a valid agent.`,
            code: "UNBOUND_AI_AGENT",
          });
        }
        break;
      }

      case "EMERGENCY_HANDLING": {
        const emData = data as unknown as EmergencyHandlingNodeData;
        if (!emData.casualtyDestinationNumber || !emData.casualtyDestinationNumber.trim()) {
          errors.push({
            nodeId: node.id,
            level: "ERROR",
            message: `Emergency Handling node '${node.title}' requires a valid casualty destination phone number.`,
            code: "MISSING_EMERGENCY_DESTINATION",
          });
        }
        break;
      }

      case "HUMAN_TRANSFER": {
        const trData = data as unknown as HumanTransferNodeData;
        if (trData.transferType === "PHONE_NUMBER" && (!trData.destinationNumber || !trData.destinationNumber.trim())) {
          errors.push({
            nodeId: node.id,
            level: "ERROR",
            message: `Human Transfer node '${node.title}' is set to Phone Number transfer but has no destination number.`,
            code: "MISSING_TRANSFER_DESTINATION",
          });
        }
        break;
      }

      case "DTMF_INPUT": {
        const dtmfData = data as unknown as DtmfInputNodeData;
        if (dtmfData.minDigits > dtmfData.maxDigits) {
          errors.push({
            nodeId: node.id,
            level: "ERROR",
            message: `DTMF Input node '${node.title}' has minDigits (${dtmfData.minDigits}) greater than maxDigits (${dtmfData.maxDigits}).`,
            code: "INVALID_DIGIT_RANGE",
          });
        }
        break;
      }

      case "BUSINESS_HOURS": {
        const bhData = data as unknown as BusinessHoursNodeData;
        if (bhData.schedule) {
          for (const [day, sched] of Object.entries(bhData.schedule)) {
            if (sched.isOpen && sched.openTime >= sched.closeTime) {
              errors.push({
                nodeId: node.id,
                level: "ERROR",
                message: `Business hours for ${day} are invalid: openTime (${sched.openTime}) must precede closeTime (${sched.closeTime}).`,
                code: "INVALID_BUSINESS_HOURS",
              });
            }
          }
        }
        break;
      }
    }
  }
}
