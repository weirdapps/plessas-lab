/**
 * Contacts Registry Module
 *
 * Manages a JSON-based registry for storing email contacts.
 * Supports case-insensitive partial name matching for lookups.
 *
 * Registry location: ~/.google-skills/gmail/contacts-registry.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Paths
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
const CREDENTIALS_DIR = path.join(HOME_DIR, '.google-skills', 'gmail');
const REGISTRY_PATH = path.join(CREDENTIALS_DIR, 'contacts-registry.json');

// Interfaces
export interface Contact {
  name: string;
  email: string;
}

export interface ContactsRegistry {
  version: string;
  contacts: Contact[];
}

/**
 * Validates email format using a simple regex.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Loads the contacts registry from disk.
 * Creates an empty registry if the file doesn't exist.
 */
export function loadRegistry(): ContactsRegistry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    const emptyRegistry: ContactsRegistry = {
      version: '1.0',
      contacts: [],
    };
    saveRegistry(emptyRegistry);
    return emptyRegistry;
  }

  const content = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  return JSON.parse(content) as ContactsRegistry;
}

/**
 * Saves the contacts registry to disk.
 */
export function saveRegistry(registry: ContactsRegistry): void {
  // Ensure directory exists
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Lists all contacts in the registry.
 */
export function listAllContacts(): Contact[] {
  const registry = loadRegistry();
  return registry.contacts;
}

/**
 * Searches contacts by name using case-insensitive partial matching.
 */
export function searchContacts(query: string): Contact[] {
  const registry = loadRegistry();
  const lowerQuery = query.toLowerCase();

  return registry.contacts.filter((contact) =>
    contact.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Adds a new contact to the registry.
 * Throws an error if a contact with the same name already exists.
 * Throws an error if the email format is invalid.
 */
export function addContact(name: string, email: string): Contact {
  if (!name || name.trim().length === 0) {
    throw new Error('Contact name cannot be empty');
  }

  if (!isValidEmail(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  const registry = loadRegistry();
  const trimmedName = name.trim();

  // Check for duplicate (case-insensitive)
  const existingContact = registry.contacts.find(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (existingContact) {
    throw new Error(`Contact already exists: ${existingContact.name} <${existingContact.email}>`);
  }

  const newContact: Contact = {
    name: trimmedName,
    email: email.trim(),
  };

  registry.contacts.push(newContact);
  saveRegistry(registry);

  return newContact;
}

/**
 * Updates an existing contact's email.
 * Uses exact name matching (case-insensitive).
 * Throws an error if the contact is not found.
 */
export function updateContact(name: string, email: string): Contact {
  if (!name || name.trim().length === 0) {
    throw new Error('Contact name cannot be empty');
  }

  if (!isValidEmail(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  const registry = loadRegistry();
  const trimmedName = name.trim().toLowerCase();

  const contactIndex = registry.contacts.findIndex(
    (c) => c.name.toLowerCase() === trimmedName
  );

  if (contactIndex === -1) {
    throw new Error(`Contact not found: ${name}`);
  }

  registry.contacts[contactIndex].email = email.trim();
  saveRegistry(registry);

  return registry.contacts[contactIndex];
}

/**
 * Removes a contact from the registry.
 * Uses exact name matching (case-insensitive).
 * Throws an error if the contact is not found.
 */
export function removeContact(name: string): Contact {
  if (!name || name.trim().length === 0) {
    throw new Error('Contact name cannot be empty');
  }

  const registry = loadRegistry();
  const trimmedName = name.trim().toLowerCase();

  const contactIndex = registry.contacts.findIndex(
    (c) => c.name.toLowerCase() === trimmedName
  );

  if (contactIndex === -1) {
    throw new Error(`Contact not found: ${name}`);
  }

  const removedContact = registry.contacts[contactIndex];
  registry.contacts.splice(contactIndex, 1);
  saveRegistry(registry);

  return removedContact;
}
