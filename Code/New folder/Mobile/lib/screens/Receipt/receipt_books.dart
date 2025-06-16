import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/widgets/appbar/app_bar.dart';
import 'package:TraceFlow/widgets/commen/progress_indicator.dart';
import '../../widgets/Receipt/Controller.dart';
import '../../widgets/Receipt/FilterSortHeader.dart';
import '../../widgets/Receipt/card.dart';
import '../../widgets/appbar/sidebar.dart';

class ReceiptBooksScreen extends StatefulWidget {
  const ReceiptBooksScreen({super.key});

  @override
  State<ReceiptBooksScreen> createState() => _ReceiptBooksScreenState();
}

class _ReceiptBooksScreenState extends State<ReceiptBooksScreen> {
  late Future<void> _fetchFuture;

  @override
  void initState() {
    super.initState();
    _fetchFuture = _fetchReceiptBooks();
  }

  Future<void> _fetchReceiptBooks() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    await Future.wait([
      receiptBookProvider.fetchReceiptBooksByHolder(authProvider.user!.userID!),
      receiptBookProvider.fetchAllReceiptBookTypes(),
    ]);
  }

  Widget _buildSectionCard(BuildContext context, {required String title, required List<Widget> children}) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.7),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Colors.grey),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: CustomAppBar(title: 'Receipt Books', showBackButton: true),
      drawer: const AppSidebar(),
      body: FutureBuilder(
        future: _fetchFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CustomProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Error: ${snapshot.error}',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            );
          }
          return Consumer2<ReceiptBookProvider, AuthProvider>(
            builder: (context, receiptBookProvider, authProvider, child) {
              if (receiptBookProvider.isLoading) {
                return const Center(child: CustomProgressIndicator());
              }
              return ReceiptBookController(
                books: receiptBookProvider.receiptBooks,
                child: Builder(builder: (context) {
                  final scope = ReceiptBookScope.of(context);
                  final filteredBooks = scope.filteredBooks;
                  return RefreshIndicator(
                    onRefresh: _fetchReceiptBooks,
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: ListView(
                        children: [
                          _buildSectionCard(
                            context,
                            title: 'Filter & Sort',
                            children: [
                              FilterSortHeader(
                                searchController: scope.searchController,
                                onSort: scope.showSortMenu,
                                onFilter: () {},
                                typeOptions: receiptBookProvider.receiptBookTypes.map((t) => t.name).toSet(),
                                initialFilters: scope.filters,
                                onApplyFilters: (filters) => scope.setFilters(filters),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (filteredBooks.isEmpty)
                            Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Text(
                                'No receipt books found.',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.colorScheme.onSurface.withOpacity(0.6),
                                ),
                                textAlign: TextAlign.center,
                              ),
                            )
                          else
                            ...filteredBooks.asMap().entries.map((entry) {
                              final index = entry.key;
                              final book = entry.value;
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4.0),
                                child: ReceiptBookCard(book: book, index: index),
                              );
                            }).toList(),
                        ],
                      ),
                    ),
                  );
                }),
              );
            },
          );
        },
      ),
    );
  }
}