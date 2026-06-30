# **Historical Decision Log (Refactor ADRs)**

This directory (`docs/refactor/`) contains the Architecture Decision Records (ADRs) and planning documents that have historically guided the evolution of VirtAI. 

## Purpose

The goal of this directory is to preserve the context around why certain technical decisions, refactors, and reliability patches were made. As the system scales and team members onboard, these documents serve as a critical reference point to prevent reversing necessary changes or re-evaluating problems that have already been solved.

## Principles
1. **Immutability**: Do NOT delete or modify historical plans once they are executed. They are records of past decisions.
2. **Context**: Use these records to understand the rationale behind the strict Clean Architecture layers, typing hygiene, Redis fail-closed behaviors, and WebSocket connection lifecycle management.
3. **New Refactors**: If a major system-wide refactor is planned, a new plan document should be added here to track its phases and acceptance criteria.
